import { TRACKER_KINDS } from "@ojo/shared";
import { dateTime, pageParam } from "@/components/admin/format";
import { FilterBar, SortTh, flatParams, listHref } from "@/components/admin/list-controls";
import { sortAndPage } from "@/components/admin/memory-list";
import { PageTitle, Pager, Panel, TABLE, TD, TH } from "@/components/admin/ui";
import { getCore } from "@/server/core";
import { requireStaff } from "@/server/session";

const BASE = "/admin/statuses";

export default async function AdminStatusesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff("stats.read");
  const params = flatParams(await searchParams);
  const kind = TRACKER_KINDS.find((item) => item === params.kind);
  const all = await getCore().admin.statusStats(kind);
  const needle = (params.q ?? "").trim().toLowerCase();
  const rows = all.filter((row) => (!params.field || row.field === params.field) && (!needle || row.value.toLowerCase().includes(needle)));
  const fields = [...new Set(all.map((row) => row.field))].sort();
  const page = sortAndPage(
    rows,
    { sort: params.sort, dir: params.dir, page: pageParam(params.page), pageSize: 50 },
    { kind: (row) => row.kind, field: (row) => row.field, value: (row) => row.value, count: (row) => row.count, lastSeenAt: (row) => row.lastSeenAt.getTime() },
    { sort: "lastSeenAt", dir: "desc" },
  );
  const sort = (label: string, field: string, dir: "asc" | "desc" = "asc") => (
    <SortTh label={label} field={field} base={BASE} params={params} defaultSort="lastSeenAt" defaultDir={field === "lastSeenAt" ? "desc" : dir} />
  );
  return (
    <>
      <PageTitle title="Statuses seen at the sources" />
      <FilterBar
        base={BASE}
        params={params}
        fields={[
          { name: "q", label: "Value contains", kind: "text", placeholder: "Search…" },
          { name: "kind", label: "Source", kind: "select", options: TRACKER_KINDS.map((value) => ({ value, label: value })) },
          { name: "field", label: "Field", kind: "select", options: fields.map((value) => ({ value, label: value })) },
        ]}
      />
      <Panel note="Every status and stage title that appeared as a change in some case, without any personal data. Use it to decide which statuses end a case.">
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr>{sort("Source", "kind")}{sort("Field", "field")}{sort("Value", "value")}{sort("Times seen", "count", "desc")}{sort("Last seen", "lastSeenAt")}<th className={TH} /></tr>
            </thead>
            <tbody>
              {page.items.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className={TD}>{row.kind}</td>
                  <td className={TD}>{row.field}</td>
                  <td className={`${TD} font-medium`}>{row.value}</td>
                  <td className={TD}>{row.count}</td>
                  <td className={TD}>{dateTime(row.lastSeenAt.toISOString())}</td>
                  <td className={TD} />
                </tr>
              ))}
              {page.items.length === 0 && <tr><td className={`${TD} text-fg-muted`} colSpan={6}>Nothing found.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={page.page} pageSize={page.pageSize} total={page.total} href={(n) => listHref(BASE, params, { page: String(n) })} />
      </Panel>
    </>
  );
}
