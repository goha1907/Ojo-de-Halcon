import { APP_CONFIG, PRICING, TRACKER_KIND_SECTION, ROUTES, sectionHref, settingsHref, type MessageKey } from "@ojo/shared";
import { Alert, Card } from "@ojo/ui";
import Link from "next/link";
import { nowMs } from "@/lib/days";
import { TONE_STYLES, toneOf } from "@/lib/status-tones";
import { currentStatus, displayNumber, lastChange } from "@/lib/tracker-view";
import { formatMoney } from "@/lib/money";
import { getCore } from "@/server/core";
import { getT } from "@/server/i18n";
import { requireUser } from "@/server/session";

const DAY_MS = 86_400_000;
/** How close an end date must be to be worth a warning. */
const SOON_DAYS = 7;
const PAGE_SIZE = 5;

/** Colour of a summary tile: the same language as the card edges, plus blue for paid places. */
const TILE_TONES = {
  tracking: { edge: TONE_STYLES.tracking.edge, number: "text-emerald-600" },
  removing: { edge: TONE_STYLES.removing.edge, number: "text-amber-500" },
  finished: { edge: TONE_STYLES.finished.edge, number: "text-red-600" },
  slots: {
    edge: "border-l-blue-500 shadow-[-8px_0_16px_-10px_rgba(59,130,246,0.7)]",
    number: "text-blue-600",
  },
  plain: { edge: "border-l-slate-200", number: "text-slate-900" },
} as const;

function Tile({
  label,
  value,
  hint,
  tone = "plain",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: keyof typeof TILE_TONES;
}) {
  const style = TILE_TONES[tone];
  return (
    <div className={`rounded-2xl border border-l-4 border-slate-200 bg-white p-4 shadow-sm ${style.edge}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${style.number}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const core = getCore();
  const [trackers, billing, access, payments] = await Promise.all([
    core.trackers.list(user.id),
    core.billing.state(user.id),
    core.access.get(user.id),
    core.billing.history(user.id, 1),
  ]);
  const { page: pageParam } = await searchParams;
  const now = nowMs();
  const money = (amount: number) => formatMoney(amount, PRICING.currency, locale);
  const day = (iso: string | number) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(iso));
  const nameOf = (item: { label: string | null; reference: string }) => item.label ?? `№ ${item.reference}`;
  const sectionLabel = (kind: keyof typeof TRACKER_KIND_SECTION) =>
    t(`sections.${TRACKER_KIND_SECTION[kind]}` as MessageKey);

  const subscribed = access.plan === "subscription";
  const open = trackers.filter((item) => item.status === "ACTIVE");
  const tracking = open.filter((item) => item.keptInSubscription);
  const removing = open.filter((item) => !item.keptInSubscription);
  const finished = trackers.filter((item) => item.status === "FINISHED");
  const paused = trackers.filter((item) => item.status === "PAUSED");
  const untilMs = access.until ? new Date(access.until).getTime() : null;
  const daysLeft = untilMs === null ? null : Math.ceil((untilMs - now) / DAY_MS);

  // things that need a decision or a look
  const attention: { key: string; tone: "info" | "error"; text: string; href?: string; action?: string }[] = [];
  for (const item of trackers.filter((row) => row.lastError === "mismatch")) {
    attention.push({ key: `m-${item.id}`, tone: "error", text: t("dash.attn.mismatch", { name: nameOf(item) }) });
  }
  for (const item of trackers.filter((row) => row.lastError === "birth_date_missing")) {
    attention.push({ key: `b-${item.id}`, tone: "error", text: t("dash.attn.birth", { name: nameOf(item) }) });
  }
  if (access.plan === "trial_expired") {
    attention.push({
      key: "trial-expired",
      tone: "error",
      text: t("dash.attn.trialExpired"),
      href: settingsHref("subscription"),
      action: t("dash.attn.subscribe"),
    });
  } else if (access.plan === "trial" && daysLeft !== null && daysLeft <= 3) {
    attention.push({
      key: "trial-ending",
      tone: "info",
      text: t("dash.attn.trialEnding", { date: day(untilMs!) }),
      href: settingsHref("subscription"),
      action: t("dash.attn.subscribe"),
    });
  }
  if (subscribed && daysLeft !== null && daysLeft <= SOON_DAYS) {
    attention.push({
      key: "ending",
      tone: "info",
      text:
        billing.keptCases > 0
          ? t("dash.attn.renewsSoon", { date: day(untilMs!), amount: money(billing.nextPeriodPrice) })
          : t("dash.attn.endsSoon", { date: day(untilMs!) }),
      href: settingsHref("subscription"),
      action: t("dash.attn.open"),
    });
  }
  if (removing.length > 0 && subscribed && untilMs !== null) {
    attention.push({
      key: "removing",
      tone: "info",
      text: t("dash.attn.removing", { count: removing.length, date: day(untilMs) }),
    });
  }
  if (subscribed && billing.freeCases > 0) {
    attention.push({ key: "free", tone: "info", text: t("dash.attn.free", { count: billing.freeCases }) });
  }
  if (!user.telegramLinked) {
    attention.push({
      key: "telegram",
      tone: "info",
      text: t("dashboard.telegramNudge"),
      href: settingsHref("telegram"),
      action: t("dashboard.telegramLink"),
    });
  }
  if (!user.profileComplete) {
    attention.push({
      key: "profile",
      tone: "info",
      text: t("dashboard.profileNudge"),
      href: settingsHref("profile"),
      action: t("dashboard.profileLink"),
    });
  }

  // a live log: the most recently changed first
  const byChange = trackers
    .filter((item) => item.status !== "FINISHED")
    .sort((a, b) => lastChange(b) - lastChange(a));
  const pages = Math.max(1, Math.ceil(byChange.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(Number(pageParam)) || 1), pages);
  const rows = byChange.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (n: number) => (n === 1 ? ROUTES.dashboard : `${ROUTES.dashboard}?page=${n}`);
  const periodStart = untilMs === null ? null : untilMs - APP_CONFIG.limits.subscriptionDays * DAY_MS;
  const usedShare = billing.paidCases > 0 ? Math.min(100, Math.round((billing.activeCases / billing.paidCases) * 100)) : 0;
  const statusBadge = (item: (typeof trackers)[number]) => {
    const tone = toneOf(item.status, item.keptInSubscription);
    const text = {
      tracking: t("dash.badge.tracking"),
      removing: t("dash.badge.removing"),
      finished: t("track.status.FINISHED"),
      paused: t("track.status.PAUSED"),
      pending: t("board.filter.pending"),
    }[tone];
    return { text, cls: TONE_STYLES[tone].badge };
  };

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">
          {user.firstName ? t("dashboard.welcome", { name: user.firstName }) : t("dashboard.welcomeAnon")}
        </h1>
        <p className="text-sm text-slate-600">{t("dash.subtitle")}</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t("dash.tile.tracking")} value={tracking.length} tone="tracking" />
        <Tile
          label={t("dash.tile.finished")}
          value={finished.length}
          tone="finished"
          hint={paused.length ? t("dash.tile.paused", { count: paused.length }) : undefined}
        />
        <Tile label={t("dash.tile.removing")} value={removing.length} tone="removing" />
        {subscribed ? (
          <Tile
            label={t("dash.tile.slots")}
            value={`${billing.activeCases} / ${billing.paidCases}`}
            tone="slots"
            hint={t("dash.tile.free", { count: billing.freeCases })}
          />
        ) : (
          <Tile
            label={t("dash.tile.plan")}
            value={access.plan === "trial" ? t("dash.tile.trial") : t("dash.tile.noPlan")}
            hint={access.until ? t("dash.tile.until", { date: day(access.until) }) : undefined}
          />
        )}
      </section>

      {attention.length > 0 && (
        <Card title={t("dash.attn.title")}>
          <ul className="space-y-2">
            {attention.map((item) => (
              <li key={item.key}>
                <Alert tone={item.tone}>
                  {item.text}
                  {item.href && item.action && (
                    <>
                      {" "}
                      <Link href={item.href} className="font-medium underline">
                        {item.action}
                      </Link>
                    </>
                  )}
                </Alert>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={t("dash.table.title")}>
        {byChange.length === 0 ? (
          <p className="text-sm text-slate-500">{t("dash.table.empty")}</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-semibold">{t("settings.notifications.case")}</th>
                    <th className="px-2 py-2 font-semibold">{t("dash.table.section")}</th>
                    <th className="px-2 py-2 font-semibold">{t("dash.table.status")}</th>
                    <th className="px-2 py-2 font-semibold">{t("dash.table.changed")}</th>
                    <th className="px-2 py-2 font-semibold">{t("dash.table.state")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => {
                    const badge = statusBadge(item);
                    const href = sectionHref(TRACKER_KIND_SECTION[item.kind]) ?? ROUTES.dashboard;
                    const status = currentStatus(item);
                    return (
                      <tr key={item.id} className="border-t border-slate-100 align-top">
                        <td className="py-3 pr-3">
                          <Link href={href} className="font-medium text-slate-900 hover:underline">
                            {item.label ?? `№ ${displayNumber(item)}`}
                          </Link>
                          {item.label && <div className="text-xs text-slate-500">№ {displayNumber(item)}</div>}
                        </td>
                        <td className="px-2 py-3 text-slate-600">{sectionLabel(item.kind)}</td>
                        <td className="px-2 py-3 text-slate-800">
                          {status || <span className="text-slate-400">{t("dash.table.noData")}</span>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 text-slate-600">
                          {status ? day(lastChange(item)) : "—"}
                        </td>
                        <td className="px-2 py-3">
                          <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                            {badge.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <nav aria-label={t("dash.table.pages")} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">
                  {t("dash.table.range", {
                    from: (page - 1) * PAGE_SIZE + 1,
                    to: Math.min(page * PAGE_SIZE, byChange.length),
                    total: byChange.length,
                  })}
                </span>
                <div className="flex items-center gap-1">
                  {page > 1 ? (
                    <Link href={pageHref(page - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
                      ←
                    </Link>
                  ) : (
                    <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-300">←</span>
                  )}
                  {Array.from({ length: pages }, (_, index) => index + 1).map((n) => (
                    <Link
                      key={n}
                      href={pageHref(n)}
                      aria-current={n === page ? "page" : undefined}
                      className={`rounded-lg border px-3 py-1.5 ${
                        n === page
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {n}
                    </Link>
                  ))}
                  {page < pages ? (
                    <Link href={pageHref(page + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
                      →
                    </Link>
                  ) : (
                    <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-300">→</span>
                  )}
                </div>
              </nav>
            )}
          </div>
        )}
      </Card>

      <Card title={t("dash.sub.title")}>
        {subscribed && untilMs !== null && periodStart !== null ? (
          <div className="space-y-5">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-slate-600">{t("dash.sub.usage")}</span>
                <span className="font-medium text-slate-900">
                  {billing.activeCases} / {billing.paidCases}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${usedShare}%` }} />
              </div>
            </div>
            <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs text-slate-500">{t("settings.sub.started")}</dt>
                <dd className="font-medium text-slate-900">{day(periodStart)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("settings.sub.nextCharge")}</dt>
                <dd className="font-medium text-slate-900">
                  {day(untilMs)}
                  <span className="ml-1 font-normal text-slate-500">({t("dash.sub.daysLeft", { count: Math.max(0, daysLeft ?? 0) })})</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("settings.sub.sum")}</dt>
                <dd className="font-medium text-slate-900">{money(billing.currentPrice)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("settings.sub.nextAmount")}</dt>
                <dd className="font-medium text-slate-900">
                  {billing.keptCases > 0 ? money(billing.nextPeriodPrice) : t("billing.cases.nextNone")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("dash.sub.free")}</dt>
                <dd className="font-medium text-slate-900">{billing.freeCases}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("settings.sub.disabledNext")}</dt>
                <dd className="font-medium text-slate-900">{billing.cancelledCases}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("settings.sub.finished")}</dt>
                <dd className="font-medium text-slate-900">{billing.finishedCases}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("dash.sub.lastPayment")}</dt>
                <dd className="font-medium text-slate-900">
                  {payments[0]
                    ? `${day(payments[0].createdAt)} · ${formatMoney(payments[0].amount, payments[0].currency, locale)}`
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="text-sm text-slate-600">{t("settings.sub.noSubscription")}</p>
        )}
        <Link href={settingsHref("subscription")} className="mt-4 inline-block text-sm text-brand-600 hover:underline">
          {t("dash.sub.open")}
        </Link>
      </Card>
    </>
  );
}
