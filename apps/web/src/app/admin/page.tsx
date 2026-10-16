import Link from "next/link";
import { money } from "@/components/admin/format";
import { PageTitle, Panel, Stat } from "@/components/admin/ui";
import { getCore } from "@/server/core";
import { requireStaff } from "@/server/session";

export default async function AdminOverviewPage() {
  await requireStaff("overview.read");
  const core = getCore();
  const [overview, sources] = await Promise.all([core.admin.overview(), core.admin.sourcesHealth()]);
  const troubled = sources.filter((row) => row.withError > 0 || row.overdue > 0);
  return (
    <>
      <PageTitle title="Overview" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Users" value={overview.users.total} hint={`${overview.users.newLast7Days} new in 7 days · ${overview.users.staff} staff`} />
        <Stat label="Running subscriptions" value={overview.subscriptions.running} hint={`${overview.subscriptions.paidPlaces} paid places`} />
        <Stat label="Estimated monthly revenue" value={money(overview.subscriptions.estimatedMonthly, overview.subscriptions.currency)} hint="From the running subscriptions, by price ladder" />
        <Stat label="Gift places in use" value={overview.gifts.activePlaces} hint={`${overview.gifts.accounts} accounts`} />
        <Stat label="Active cases" value={overview.trackers.active} hint={`${overview.trackers.finished} finished · ${overview.trackers.paused} paused`} />
        <Stat label="Cases with a source error" value={overview.trackers.withError} />
        <Stat label="New inbox messages" value={<Link href="/admin/feedback?status=NEW" className="hover:underline">{overview.feedbackNew}</Link>} />
        <Stat label="Telegram messages waiting" value={overview.outboxPending} hint="Farewell and “places ended” notices" />
      </div>
      <div className="mt-6">
        <Panel title="Sources needing attention" note="Cases with a source error, or overdue by more than an hour.">
          {troubled.length === 0 ? (
            <p className="text-sm text-fg-muted">All sources look healthy.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {troubled.map((row) => (
                <li key={row.kind}>
                  <Link href="/admin/sources" className="font-medium hover:underline">{row.kind}</Link>: {row.withError} with errors, {row.overdue} overdue of {row.active}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
