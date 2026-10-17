import Link from "next/link";
import { dateOnly, pageParam } from "@/components/admin/format";
import { FilterBar, SortTh, flatParams, listHref, type FilterField } from "@/components/admin/list-controls";
import { Badge, PageTitle, Pager, Panel, TABLE, TD } from "@/components/admin/ui";
import { getCore } from "@/server/core";
import { requireStaff } from "@/server/session";

const BASE = "/admin/users";
const YES_NO = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];

const FIELDS: FilterField[] = [
  { name: "q", label: "E-mail or user id", kind: "text", placeholder: "Search…" },
  { name: "role", label: "Role", kind: "select", options: [{ value: "USER", label: "Customer" }, { value: "staff", label: "Any staff" }, { value: "SUPPORT", label: "Support" }, { value: "ADMIN", label: "Admin" }] },
  { name: "plan", label: "Plan", kind: "select", options: [{ value: "subscription", label: "Subscription" }, { value: "gift", label: "Gift places" }, { value: "trial", label: "Trial" }, { value: "none", label: "No places" }] },
  { name: "gift", label: "Gift places in use", kind: "select", options: [{ value: "yes", label: "Has gift places" }] },
  { name: "cases", label: "Cases", kind: "select", options: [{ value: "active", label: "Has active cases" }, { value: "none", label: "No active cases" }] },
  { name: "telegram", label: "Telegram", kind: "select", options: YES_NO.map((o) => ({ ...o, label: o.value === "yes" ? "Linked" : "Not linked" })) },
  { name: "verified", label: "E-mail verified", kind: "select", options: YES_NO },
  { name: "earlyAccess", label: "Early access", kind: "select", options: [{ value: "yes", label: "Has it" }] },
  { name: "from", label: "Joined from", kind: "date" },
  { name: "to", label: "Joined to", kind: "date" },
];

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff("users.read");
  const params = flatParams(await searchParams);
  const result = await getCore().admin.listUsers({
    ...(params.q ? { query: params.q } : {}),
    ...(params.role ? { role: params.role } : {}),
    ...(params.plan ? { plan: params.plan } : {}),
    ...(params.gift ? { gift: params.gift } : {}),
    ...(params.cases ? { cases: params.cases } : {}),
    ...(params.telegram ? { telegram: params.telegram } : {}),
    ...(params.verified ? { verified: params.verified } : {}),
    ...(params.earlyAccess ? { earlyAccess: params.earlyAccess } : {}),
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
    ...(params.sort ? { sort: params.sort } : {}),
    ...(params.dir === "asc" || params.dir === "desc" ? { dir: params.dir } : {}),
    page: pageParam(params.page),
  });
  const sort = (label: string, field: string, defaultDir: "asc" | "desc" = "asc") => (
    <SortTh label={label} field={field} base={BASE} params={params} defaultSort="createdAt" defaultDir={field === "createdAt" ? "desc" : defaultDir} />
  );
  return (
    <>
      <PageTitle title="Users" />
      <FilterBar base={BASE} fields={FIELDS} params={params} />
      <Panel>
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr>
                {sort("E-mail", "email")}
                {sort("Role", "role")}
                {sort("Plan", "plan")}
                {sort("Places", "places", "desc")}
                {sort("Gift places", "gift", "desc")}
                {sort("Cases", "cases", "desc")}
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Telegram</th>
                {sort("Joined", "createdAt")}
              </tr>
            </thead>
            <tbody>
              {result.items.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className={TD}>
                    <Link href={`/admin/users/${row.id}`} className="font-medium text-fg hover:underline">{row.email}</Link>
                    {!row.emailVerified && <span className="ml-2"><Badge tone="amber">unverified</Badge></span>}
                  </td>
                  <td className={TD}>{row.role === "USER" ? <span className="text-fg-muted">user</span> : <Badge tone="blue">{row.role}</Badge>}</td>
                  <td className={TD}><Badge tone={row.plan === "subscription" ? "green" : row.plan === "none" ? "red" : "slate"}>{row.plan}</Badge></td>
                  <td className={TD}>{row.places}</td>
                  <td className={TD}>{row.gift > 0 ? <Badge tone="blue">{row.gift}</Badge> : <span className="text-fg-muted">0</span>}</td>
                  <td className={TD}>{row.cases}</td>
                  <td className={TD}>{row.telegramLinked ? "linked" : "—"}</td>
                  <td className={TD}>{dateOnly(row.createdAt)}</td>
                </tr>
              ))}
              {result.items.length === 0 && (
                <tr><td className={`${TD} text-fg-muted`} colSpan={8}>No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={result.page} pageSize={result.pageSize} total={result.total} href={(n) => listHref(BASE, params, { page: String(n) })} />
      </Panel>
    </>
  );
}
