import { can } from "@ojo/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dateOnly, dateTime, money, pageParam } from "@/components/admin/format";
import { FilterBar, SortTh, flatParams, listHref } from "@/components/admin/list-controls";
import { EarlyAccessToggle } from "@/components/admin/early-access-toggle";
import { GiveGrantForm, GrantRowActions } from "@/components/admin/grant-controls";
import { Badge, PageTitle, Pager, Panel, Stat, TABLE, TD, TH } from "@/components/admin/ui";
import { getCore } from "@/server/core";
import { SubscriptionTools } from "@/components/admin/subscription-tools";
import { getEnv } from "@/server/env";
import { requireStaff } from "@/server/session";

export default async function AdminUserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const staff = await requireStaff("users.read");
  const { id } = await params;
  const query = flatParams(await searchParams);
  const core = getCore();
  const detail = await core.admin.userDetail(id);
  if (!detail) notFound();
  const { user, access, billing, grants, trackers } = detail;
  const base = `/admin/users/${id}`;
  const [payments, audit] = await Promise.all([
    core.admin.userPayments(id, {
      page: pageParam(query.pay_page),
      ...(query.pay_kind ? { kind: query.pay_kind } : {}),
      ...(query.pay_provider ? { provider: query.pay_provider } : {}),
      ...(query.pay_from ? { from: query.pay_from } : {}),
      ...(query.pay_to ? { to: query.pay_to } : {}),
      ...(query.pay_sort ? { sort: query.pay_sort } : {}),
      ...(query.pay_dir === "asc" || query.pay_dir === "desc" ? { dir: query.pay_dir } : {}),
    }),
    core.admin.auditLog({
      userId: id,
      pageSize: 10,
      page: pageParam(query.act_page),
      ...(query.act_q ? { query: query.act_q } : {}),
      ...(query.act_action ? { action: query.act_action } : {}),
      ...(query.act_from ? { from: query.act_from } : {}),
      ...(query.act_to ? { to: query.act_to } : {}),
      ...(query.act_sort ? { sort: query.act_sort } : {}),
      ...(query.act_dir === "asc" || query.act_dir === "desc" ? { dir: query.act_dir } : {}),
    }),
  ]);
  const payKeys = { sort: "pay_sort", dir: "pay_dir", page: "pay_page" };
  const actKeys = { sort: "act_sort", dir: "act_dir", page: "act_page" };
  const paySort = (label: string, field: string) => (
    <SortTh label={label} field={field} base={base} params={query} keys={payKeys} defaultSort="createdAt" defaultDir={field === "createdAt" ? "desc" : "asc"} />
  );
  const actSort = (label: string, field: string) => (
    <SortTh label={label} field={field} base={base} params={query} keys={actKeys} defaultSort="createdAt" defaultDir={field === "createdAt" ? "desc" : "asc"} />
  );
  const canGrant = can(staff.role, "grants.manage");
  const canManage = can(staff.role, "users.manage");
  return (
    <>
      <PageTitle title={user.email}>
        <Link href="/admin/users" className="text-sm text-fg-muted hover:underline">← All users</Link>
      </PageTitle>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Account">
          <dl className="grid grid-cols-[9rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-fg-muted">User id</dt><dd className="break-all font-mono text-xs">{user.id}</dd>
            <dt className="text-fg-muted">Role</dt><dd>{user.role}</dd>
            <dt className="text-fg-muted">Name</dt><dd>{[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}</dd>
            <dt className="text-fg-muted">E-mail</dt><dd>{user.emailVerified ? "verified" : <Badge tone="amber">not verified</Badge>}</dd>
            <dt className="text-fg-muted">Telegram</dt><dd>{user.telegramLinked ? `linked${user.telegramUsername ? ` (@${user.telegramUsername})` : ""}` : "not linked"}</dd>
            <dt className="text-fg-muted">Early access</dt>
            <dd>
              {canManage ? (
                <EarlyAccessToggle userId={user.id} enabled={user.earlyAccess} staff={user.role !== "USER"} />
              ) : user.role !== "USER" || user.earlyAccess ? (
                "yes"
              ) : (
                "no"
              )}
            </dd>
            <dt className="text-fg-muted">Language</dt><dd>{user.locale}</dd>
            <dt className="text-fg-muted">Joined</dt><dd>{dateTime(user.createdAt)}</dd>
          </dl>
        </Panel>
        <Panel title="Access">
          <dl className="grid grid-cols-[9rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-fg-muted">Plan</dt><dd><Badge tone={access.plan === "subscription" ? "green" : access.plan === "none" ? "red" : "slate"}>{access.plan}</Badge></dd>
            <dt className="text-fg-muted">Subscription until</dt><dd>{user.subscriptionUntil ? `${dateOnly(user.subscriptionUntil)}${user.renews ? "" : " (will not renew)"}` : "—"}</dd>
            <dt className="text-fg-muted">Paid places</dt><dd>{billing.paidCases} ({billing.paidUsedCases} used)</dd>
            <dt className="text-fg-muted">Granted places</dt><dd>{billing.grantedCases} ({billing.grantedUsedCases} used)</dd>
            <dt className="text-fg-muted">Free places left</dt><dd>{billing.freeCases}</dd>
            <dt className="text-fg-muted">Next period</dt><dd>{billing.nextPeriodCases} paid places · {money(billing.nextPeriodPrice, billing.currency)}</dd>
          </dl>
          {canManage && getEnv().PAYMENTS_STUB && (
            <div className="mt-3 border-t border-line pt-3">
              <SubscriptionTools userId={user.id} subscribed={access.plan === "subscription"} />
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 space-y-4">
        <Panel title="Trial and gift places" note="Granted places are used first and cost nothing. Without an end date they keep going until revoked. Giving places ends the trial.">
          {grants.length === 0 ? (
            <p className="text-sm text-fg-muted">None.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={TABLE}>
                <thead>
                  <tr><th className={TH}>Type</th><th className={TH}>Places</th><th className={TH}>From</th><th className={TH}>Until</th><th className={TH}>Note</th><th className={TH}>Status</th>{canGrant && <th className={TH}>Actions</th>}</tr>
                </thead>
                <tbody>
                  {grants.map((grant) => (
                    <tr key={grant.id} className="border-t border-line">
                      <td className={TD}>{grant.kind}</td>
                      <td className={TD}>{grant.cases}</td>
                      <td className={TD}>{dateOnly(grant.startsAt)}</td>
                      <td className={TD}>{grant.expiresAt ? dateTime(grant.expiresAt) : "no end date"}</td>
                      <td className={TD}>{grant.note ?? "—"}</td>
                      <td className={TD}><Badge tone={grant.active ? "green" : "slate"}>{grant.active ? "active" : "ended"}</Badge></td>
                      {canGrant && (
                        <td className={TD}>
                          {grant.active ? <GrantRowActions grantId={grant.id} expiresAt={grant.expiresAt} /> : null}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {canGrant && (
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="mb-2 text-sm font-semibold text-fg">Give places</h3>
              <GiveGrantForm userId={user.id} />
            </div>
          )}
        </Panel>

        <Panel title={`Cases (${trackers.length})`}>
          {trackers.length === 0 ? (
            <p className="text-sm text-fg-muted">No cases.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={TABLE}>
                <thead>
                  <tr><th className={TH}>Source</th><th className={TH}>Number</th><th className={TH}>Name</th><th className={TH}>Status</th><th className={TH}>Source state</th><th className={TH}>Last check</th><th className={TH}>Error</th></tr>
                </thead>
                <tbody>
                  {trackers.map((row) => (
                    <tr key={row.id} className="border-t border-line">
                      <td className={TD}>{row.kind}</td>
                      <td className={`${TD} font-mono text-xs`}>{row.reference}</td>
                      <td className={TD}>{row.label ?? "—"}</td>
                      <td className={TD}>{row.status}{row.status === "ACTIVE" && !row.keepNext ? " (marked for removal)" : ""}</td>
                      <td className={TD}>{row.header.status ?? row.header.sit_actual ?? row.header.state ?? "—"}</td>
                      <td className={TD}>{dateTime(row.lastCheckedAt)}</td>
                      <td className={`${TD} text-error-fg`}>{row.lastError ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Payments">
          <FilterBar
            base={base}
            params={query}
            pageKey="pay_page"
            fields={[
              { name: "pay_kind", label: "Kind", kind: "select", options: payments.kinds.map((value) => ({ value, label: value })) },
              { name: "pay_provider", label: "Provider", kind: "select", options: payments.providers.map((value) => ({ value, label: value === "stub" ? "stub (test)" : value })) },
              { name: "pay_from", label: "From", kind: "date" },
              { name: "pay_to", label: "To", kind: "date" },
            ]}
          />
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>
                  {paySort("When", "createdAt")}
                  {paySort("Kind", "kind")}
                  <th className={TH}>Places</th>
                  {paySort("Provider", "provider")}
                  {paySort("Amount", "amount")}
                  <th className={TH}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {payments.items.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className={`${TD} whitespace-nowrap`}>{dateTime(row.createdAt)}</td>
                    <td className={TD}>{row.kind}</td>
                    <td className={TD}>{row.casesDelta ? `+${row.casesDelta}` : "—"}</td>
                    <td className={TD}>{row.provider === "stub" ? <Badge tone="amber">stub (test)</Badge> : row.provider}{row.method ? <span className="text-fg-muted"> · {row.method}</span> : null}</td>
                    <td className={`${TD} font-medium`}>{money(row.amount, row.currency)}</td>
                    <td className={TD}>
                      {row.receiptUrl ? (
                        <a href={row.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Open</a>
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {payments.items.length === 0 && <tr><td className={`${TD} text-fg-muted`} colSpan={6}>No payments.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager page={payments.page} pageSize={payments.pageSize} total={payments.total} href={(n) => listHref(base, query, { pay_page: String(n) })} />
        </Panel>

        <Panel title="Admin actions on this account">
          <FilterBar
            base={base}
            params={query}
            pageKey="act_page"
            fields={[
              { name: "act_action", label: "Action", kind: "select", options: audit.actions.map((value) => ({ value, label: value })) },
              { name: "act_q", label: "Staff e-mail", kind: "text", placeholder: "Search…" },
              { name: "act_from", label: "From", kind: "date" },
              { name: "act_to", label: "To", kind: "date" },
            ]}
          />
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>{actSort("When", "createdAt")}{actSort("Action", "action")}{actSort("Who", "actorEmail")}<th className={TH}>Details</th></tr>
              </thead>
              <tbody>
                {audit.items.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className={`${TD} whitespace-nowrap`}>{dateTime(row.createdAt)}</td>
                    <td className={`${TD} font-medium`}>{row.action}</td>
                    <td className={TD}>{row.actorEmail}</td>
                    <td className={`${TD} break-all font-mono text-xs text-fg-muted`}>{row.details ? JSON.stringify(row.details) : ""}</td>
                  </tr>
                ))}
                {audit.items.length === 0 && <tr><td className={`${TD} text-fg-muted`} colSpan={4}>No actions.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager page={audit.page} pageSize={audit.pageSize} total={audit.total} href={(n) => listHref(base, query, { act_page: String(n) })} />
        </Panel>
        <Stat label="Cases right now" value={`${billing.activeCases} active · ${billing.finishedCases} finished`} />
      </div>
    </>
  );
}
