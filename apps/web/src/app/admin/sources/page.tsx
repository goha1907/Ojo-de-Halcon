import { dateTime } from "@/components/admin/format";
import { Badge, PageTitle, Panel, TABLE, TD, TH } from "@/components/admin/ui";
import { getCore } from "@/server/core";
import { requireStaff } from "@/server/session";

export default async function AdminSourcesPage() {
  await requireStaff("sources.read");
  const rows = await getCore().admin.sourcesHealth();
  return (
    <>
      <PageTitle title="Sources" />
      <Panel note="Per kind of source, over the active cases. “Overdue” means the next check was due more than an hour ago.">
        {rows.length === 0 ? (
          <p className="text-sm text-fg-muted">No active cases yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr><th className={TH}>Source</th><th className={TH}>Active cases</th><th className={TH}>With error</th><th className={TH}>Overdue</th><th className={TH}>Last successful check</th><th className={TH}>Top errors</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.kind} className="border-t border-line">
                    <td className={`${TD} font-medium`}>{row.kind}</td>
                    <td className={TD}>{row.active}</td>
                    <td className={TD}>{row.withError > 0 ? <Badge tone="red">{row.withError}</Badge> : <Badge tone="green">0</Badge>}</td>
                    <td className={TD}>{row.overdue > 0 ? <Badge tone="amber">{row.overdue}</Badge> : 0}</td>
                    <td className={TD}>{dateTime(row.lastCheckedAt)}</td>
                    <td className={TD}>{row.topErrors.map((item) => `${item.error} (${item.count})`).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
