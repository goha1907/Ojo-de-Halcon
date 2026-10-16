import { TRACKER_KINDS, type TrackerKindValue } from "@ojo/shared";
import Link from "next/link";
import { dateTime } from "@/components/admin/format";
import { PageTitle, Panel, TABLE, TD, TH } from "@/components/admin/ui";
import { getCore } from "@/server/core";
import { requireStaff } from "@/server/session";

export default async function AdminStatusesPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requireStaff("stats.read");
  const { kind } = await searchParams;
  const selected = TRACKER_KINDS.find((item) => item === kind) as TrackerKindValue | undefined;
  const rows = await getCore().admin.statusStats(selected);
  return (
    <>
      <PageTitle title="Statuses seen at the sources" />
      <div className="mb-4 flex flex-wrap gap-2">
        {[undefined, ...TRACKER_KINDS].map((item) => (
          <Link
            key={item ?? "all"}
            href={item ? `/admin/statuses?kind=${item}` : "/admin/statuses"}
            className={`rounded-field border px-3 py-1 text-sm ${selected === item ? "border-brand bg-brand text-brand-fg" : "border-line bg-surface hover:bg-line/40"}`}
          >
            {item ?? "All"}
          </Link>
        ))}
      </div>
      <Panel note="Every status and stage title that appeared as a change in some case, without any personal data. Use it to decide which statuses end a case.">
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr><th className={TH}>Source</th><th className={TH}>Field</th><th className={TH}>Value</th><th className={TH}>Times seen</th><th className={TH}>Last seen</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className={TD}>{row.kind}</td>
                  <td className={TD}>{row.field}</td>
                  <td className={`${TD} font-medium`}>{row.value}</td>
                  <td className={TD}>{row.count}</td>
                  <td className={TD}>{dateTime(row.lastSeenAt.toISOString())}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td className={`${TD} text-fg-muted`} colSpan={5}>Nothing recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
