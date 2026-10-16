import { PRICING, TRACKER_KIND_SECTION, ROUTES, sectionHref, settingsHref, type MessageKey } from "@ojo/shared";
import { Alert, Card } from "@ojo/ui";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { StatTile } from "@/components/stat-tile";
import { AddTrackerButton } from "@/components/trackers/add-tracker-button";
import { SubscriptionSummary } from "@/components/subscription/summary";
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
  const nameOf = (item: Parameters<typeof displayNumber>[0] & { label: string | null }) =>
    item.label ?? `№ ${displayNumber(item)}`;
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
  if (access.plan === "none") {
    attention.push({
      key: "trial-expired",
      tone: "error",
      text: t(access.endedKind && access.endedKind !== "TRIAL" ? "dash.attn.giftEnded" : "dash.attn.trialExpired"),
      href: settingsHref("subscription"),
      action: t("dash.attn.subscribe"),
    });
  } else if (access.plan === "granted" && daysLeft !== null && daysLeft <= 3) {
    attention.push({
      key: "trial-ending",
      tone: "info",
      text: t(access.giftCases > 0 ? "dash.attn.giftEnding" : "dash.attn.trialEnding", { date: day(untilMs!) }),
      href: settingsHref("subscription"),
      action: t("dash.attn.subscribe"),
    });
  }
  if (subscribed && !billing.renews && untilMs !== null) {
    attention.push({
      key: "cancelled",
      tone: "info",
      text: t("dash.attn.cancelled", { date: day(untilMs) }),
      href: settingsHref("subscription"),
      action: t("billing.resumeAll"),
    });
  } else if (subscribed && daysLeft !== null && daysLeft <= SOON_DAYS) {
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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-fg">
            {user.firstName ? t("dashboard.welcome", { name: user.firstName }) : t("dashboard.welcomeAnon")}
          </h1>
          <p className="text-sm text-fg-muted">{t("dash.subtitle")}</p>
        </div>
        <AddTrackerButton />
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t("dash.tile.tracking")} value={tracking.length} tone="tracking" />
        <StatTile label={t("dash.tile.removing")} value={removing.length} tone="removing" />
        <StatTile
          label={t("dash.tile.finished")}
          value={finished.length}
          tone="finished"
          hint={paused.length ? t("dash.tile.paused", { count: paused.length }) : undefined}
        />
        {subscribed ? (
          <StatTile
            label={t("dash.tile.slots")}
            value={`${billing.paidUsedCases} / ${billing.paidCases}`}
            tone="slots"
            hint={t("dash.tile.free", { count: billing.freeCases })}
          />
        ) : (
          <StatTile
            label={t("dash.tile.plan")}
            value={
              access.plan === "granted"
                ? t(access.giftCases > 0 && access.trialCases === 0 ? "dash.tile.gift" : "dash.tile.trial")
                : t("dash.tile.noPlan")
            }
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
          <p className="text-sm text-fg-muted">{t("dash.table.empty")}</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-fg-muted">
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
                      <tr key={item.id} className="border-t border-line align-top">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <Link href={href} className="font-medium text-fg hover:underline">
                              {item.label ?? `№ ${displayNumber(item)}`}
                            </Link>
                            {!item.label && <CopyButton text={displayNumber(item)} />}
                          </div>
                          {item.label && (
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-fg-muted">
                              № {displayNumber(item)}
                              <CopyButton text={displayNumber(item)} />
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-3 text-fg-muted">{sectionLabel(item.kind)}</td>
                        <td className="px-2 py-3 text-fg">
                          {status || <span className="text-fg-muted">{t("dash.table.noData")}</span>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 text-fg-muted">
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
              <nav aria-label={t("dash.table.pages")} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-fg-muted">
                  {t("dash.table.range", {
                    from: (page - 1) * PAGE_SIZE + 1,
                    to: Math.min(page * PAGE_SIZE, byChange.length),
                    total: byChange.length,
                  })}
                </span>
                <div className="flex items-center gap-1">
                  {page > 1 ? (
                    <Link href={pageHref(page - 1)} className="rounded-field border border-line px-3 py-1.5 hover:bg-line/40">
                      ←
                    </Link>
                  ) : (
                    <span className="rounded-field border border-line px-3 py-1.5 text-fg-subtle">←</span>
                  )}
                  {Array.from({ length: pages }, (_, index) => index + 1).map((n) => (
                    <Link
                      key={n}
                      href={pageHref(n)}
                      aria-current={n === page ? "page" : undefined}
                      className={`rounded-field border px-3 py-1.5 ${
                        n === page
                          ? "border-brand bg-brand text-brand-fg"
                          : "border-line hover:bg-line/40"
                      }`}
                    >
                      {n}
                    </Link>
                  ))}
                  {page < pages ? (
                    <Link href={pageHref(page + 1)} className="rounded-field border border-line px-3 py-1.5 hover:bg-line/40">
                      →
                    </Link>
                  ) : (
                    <span className="rounded-field border border-line px-3 py-1.5 text-fg-subtle">→</span>
                  )}
                </div>
              </nav>
          </div>
        )}
      </Card>

      <Card title={t("dash.sub.title")}>
        {subscribed && access.until ? (
          <SubscriptionSummary
            billing={billing}
            untilIso={access.until}
            daysLeft={daysLeft ?? 0}
            lastPayment={payments[0] ?? null}
          />
        ) : (
          <p className="text-sm text-fg-muted">{t("settings.sub.noSubscription")}</p>
        )}
        <Link href={settingsHref("subscription")} className="mt-4 inline-block text-sm text-fg underline underline-offset-2 hover:text-fg-muted">
          {t("dash.sub.open")}
        </Link>
      </Card>
    </>
  );
}
