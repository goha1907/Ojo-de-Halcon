import { PRICING, TRACKER_KIND_SECTION, ROUTES, sectionHref, settingsHref, type MessageKey } from "@ojo/shared";
import { Alert, Card } from "@ojo/ui";
import Link from "next/link";
import { nowMs } from "@/lib/days";
import { currentStatus, displayNumber, lastChange } from "@/lib/tracker-view";
import { formatMoney } from "@/lib/money";
import { getCore } from "@/server/core";
import { getT } from "@/server/i18n";
import { requireUser } from "@/server/session";

const DAY_MS = 86_400_000;
/** How close an end date must be to be worth a warning. */
const SOON_DAYS = 7;
const TABLE_ROWS = 8;

function Tile({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "warn" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone === "warn" && Number(value) > 0 ? "text-amber-600" : "text-slate-900"}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const core = getCore();
  const [trackers, billing, access, events] = await Promise.all([
    core.trackers.list(user.id),
    core.billing.state(user.id),
    core.access.get(user.id),
    core.trackers.recentEvents(user.id),
  ]);
  const now = nowMs();
  const money = (amount: number) => formatMoney(amount, PRICING.currency, locale);
  const day = (iso: string | number) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(iso));
  const dateTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
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

  const byChange = [...trackers].sort((a, b) => lastChange(b) - lastChange(a));
  const statusBadge = (item: (typeof trackers)[number]) => {
    if (item.status === "FINISHED") return { text: t("track.status.FINISHED"), cls: "bg-slate-100 text-slate-600" };
    if (item.status === "PAUSED") return { text: t("track.status.PAUSED"), cls: "bg-slate-100 text-slate-600" };
    if (item.status === "PENDING_CONFIRMATION")
      return { text: t("board.filter.pending"), cls: "bg-amber-50 text-amber-700" };
    if (!item.keptInSubscription) return { text: t("dash.badge.removing"), cls: "bg-amber-50 text-amber-700" };
    return { text: t("dash.badge.tracking"), cls: "bg-emerald-50 text-emerald-700" };
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
        <Tile label={t("dash.tile.tracking")} value={tracking.length} />
        <Tile label={t("dash.tile.finished")} value={finished.length} hint={paused.length ? t("dash.tile.paused", { count: paused.length }) : undefined} />
        <Tile label={t("dash.tile.removing")} value={removing.length} tone="warn" />
        {subscribed ? (
          <Tile
            label={t("dash.tile.slots")}
            value={`${billing.activeCases} / ${billing.paidCases}`}
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

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card title={t("dash.table.title")}>
            {trackers.length === 0 ? (
              <p className="text-sm text-slate-500">{t("dash.table.empty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-semibold">{t("settings.notifications.case")}</th>
                      <th className="px-2 py-2 font-semibold">{t("dash.table.status")}</th>
                      <th className="px-2 py-2 font-semibold">{t("dash.table.state")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byChange.slice(0, TABLE_ROWS).map((item) => {
                      const badge = statusBadge(item);
                      const href = sectionHref(TRACKER_KIND_SECTION[item.kind]) ?? ROUTES.dashboard;
                      const status = currentStatus(item);
                      return (
                        <tr key={item.id} className="border-t border-slate-100 align-top">
                          <td className="py-2.5 pr-3">
                            <Link href={href} className="font-medium text-slate-900 hover:underline">
                              {item.label ?? `№ ${displayNumber(item)}`}
                            </Link>
                            <div className="text-xs text-slate-500">
                              {item.label ? `№ ${displayNumber(item)} · ` : ""}
                              {sectionLabel(item.kind)}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-slate-700">
                            {status || <span className="text-slate-400">{t("dash.table.noData")}</span>}
                            {status && (
                              <div className="text-xs text-slate-500">{day(lastChange(item))}</div>
                            )}
                          </td>
                          <td className="px-2 py-2.5">
                            <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                              {badge.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {trackers.length > TABLE_ROWS && (
                  <p className="mt-2 text-xs text-slate-500">
                    {t("dash.table.more", { count: trackers.length - TABLE_ROWS })}
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card title={t("dash.events.title")}>
            {events.length === 0 ? (
              <p className="text-sm text-slate-500">{t("dash.events.empty")}</p>
            ) : (
              <ul className="space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="text-sm">
                    <div className="text-xs text-slate-500">{dateTime(event.createdAt)}</div>
                    <div className="font-medium text-slate-900">{nameOf(event)}</div>
                    <div className="text-slate-700">
                      {event.initial ? `${t("dash.events.added")}: ` : ""}
                      {event.title || t("dash.table.noData")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t("dash.sub.title")}>
            {subscribed && untilMs !== null ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">{t("settings.sub.sum")}</dt>
                  <dd className="font-medium text-slate-900">{money(billing.currentPrice)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">{t("settings.sub.nextCharge")}</dt>
                  <dd className="font-medium text-slate-900">{day(untilMs)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">{t("settings.sub.nextAmount")}</dt>
                  <dd className="font-medium text-slate-900">
                    {billing.keptCases > 0 ? money(billing.nextPeriodPrice) : t("billing.cases.nextNone")}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-600">{t("settings.sub.noSubscription")}</p>
            )}
            <Link href={settingsHref("subscription")} className="mt-3 inline-block text-sm text-brand-600 hover:underline">
              {t("dash.sub.open")}
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
