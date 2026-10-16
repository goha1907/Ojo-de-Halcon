import Link from "next/link";
import { dateOnly, pageParam } from "@/components/admin/format";
import { Badge, PageTitle, Pager, Panel, TABLE, TD, TH } from "@/components/admin/ui";
import { getCore } from "@/server/core";
import { requireStaff } from "@/server/session";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireStaff("users.read");
  const { q, page } = await searchParams;
  const result = await getCore().admin.listUsers({ ...(q ? { query: q } : {}), page: pageParam(page) });
  const href = (n: number) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`;
  return (
    <>
      <PageTitle title="Users" />
      <form className="mb-4 flex gap-2" action="/admin/users">
        <input name="q" defaultValue={q ?? ""} placeholder="Search by e-mail or user id" className="w-full max-w-sm rounded-field border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-2 focus-visible:outline-ring" />
        <button className="rounded-field bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover">Search</button>
      </form>
      <Panel>
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>E-mail</th>
                <th className={TH}>Role</th>
                <th className={TH}>Plan</th>
                <th className={TH}>Places</th>
                <th className={TH}>Cases</th>
                <th className={TH}>Telegram</th>
                <th className={TH}>Joined</th>
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
                  <td className={TD}>{row.cases}</td>
                  <td className={TD}>{row.telegramLinked ? "linked" : "—"}</td>
                  <td className={TD}>{dateOnly(row.createdAt)}</td>
                </tr>
              ))}
              {result.items.length === 0 && (
                <tr><td className={`${TD} text-fg-muted`} colSpan={7}>No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={result.page} pageSize={result.pageSize} total={result.total} href={href} />
      </Panel>
    </>
  );
}
