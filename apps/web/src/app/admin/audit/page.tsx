import Link from "next/link";
import { dateTime, pageParam } from "@/components/admin/format";
import { FilterBar, SortTh, flatParams, listHref } from "@/components/admin/list-controls";
import { PageTitle, Pager, Panel, TABLE, TD, TH } from "@/components/admin/ui";
import { getCore } from "@/server/core";
import { requireStaff } from "@/server/session";

const BASE = "/admin/audit";

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff("audit.read");
  const params = flatParams(await searchParams);
  const result = await getCore().admin.auditLog({
    page: pageParam(params.page),
    ...(params.q ? { query: params.q } : {}),
    ...(params.action ? { action: params.action } : {}),
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
    ...(params.sort ? { sort: params.sort } : {}),
    ...(params.dir === "asc" || params.dir === "desc" ? { dir: params.dir } : {}),
  });
  const sort = (label: string, field: string) => (
    <SortTh label={label} field={field} base={BASE} params={params} defaultSort="createdAt" defaultDir={field === "createdAt" ? "desc" : "asc"} />
  );
  return (
    <>
      <PageTitle title="Audit log" />
      <FilterBar
        base={BASE}
        params={params}
        fields={[
          { name: "q", label: "Staff or account e-mail", kind: "text", placeholder: "Search…" },
          { name: "action", label: "Action", kind: "select", options: result.actions.map((value) => ({ value, label: value })) },
          { name: "from", label: "From", kind: "date" },
          { name: "to", label: "To", kind: "date" },
        ]}
      />
      <Panel note="Everything staff changed in the admin area. Entries are kept even after an account is deleted.">
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr>{sort("When", "createdAt")}{sort("Who", "actorEmail")}{sort("Action", "action")}{sort("Account", "targetEmail")}<th className={TH}>Details</th></tr>
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
              {result.items.length === 0 && <tr><td className={`${TD} text-fg-muted`} colSpan={5}>Nothing found.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={result.page} pageSize={result.pageSize} total={result.total} href={(n) => listHref(BASE, params, { page: String(n) })} />
      </Panel>
    </>
  );
}
