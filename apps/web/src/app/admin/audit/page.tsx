import Link from "next/link";
import { dateTime, pageParam } from "@/components/admin/format";
import { PageTitle, Pager, Panel, TABLE, TD, TH } from "@/components/admin/ui";
import { getCore } from "@/server/core";
import { requireStaff } from "@/server/session";

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireStaff("audit.read");
  const { page } = await searchParams;
  const result = await getCore().admin.auditLog({ page: pageParam(page) });
  return (
    <>
      <PageTitle title="Audit log" />
      <Panel note="Everything staff changed in the admin area. Entries are kept even after an account is deleted.">
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr><th className={TH}>When</th><th className={TH}>Who</th><th className={TH}>Action</th><th className={TH}>Account</th><th className={TH}>Details</th></tr>
            </thead>
            <tbody>
              {result.items.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className={`${TD} whitespace-nowrap`}>{dateTime(row.createdAt)}</td>
                  <td className={TD}>{row.actorEmail}</td>
                  <td className={`${TD} font-medium`}>{row.action}</td>
                  <td className={TD}>
                    {row.targetUserId ? <Link href={`/admin/users/${row.targetUserId}`} className="hover:underline">{row.targetEmail}</Link> : (row.targetEmail ?? "—")}
                  </td>
                  <td className={`${TD} break-all font-mono text-xs text-fg-muted`}>{row.details ? JSON.stringify(row.details) : ""}</td>
                </tr>
              ))}
              {result.items.length === 0 && <tr><td className={`${TD} text-fg-muted`} colSpan={5}>Nothing yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={result.page} pageSize={result.pageSize} total={result.total} href={(n) => `/admin/audit?page=${n}`} />
      </Panel>
    </>
  );
}
