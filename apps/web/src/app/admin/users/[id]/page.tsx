import { can } from "@ojo/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dateOnly, dateTime, money } from "@/components/admin/format";
import { GiveGrantForm, GrantRowActions } from "@/components/admin/grant-controls";
import { Badge, PageTitle, Panel, Stat, TABLE, TD, TH } from "@/components/admin/ui";
import { getCore } from "@/server/core";
import { requireStaff } from "@/server/session";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("users.read");
  const { id } = await params;
  const detail = await getCore().admin.userDetail(id);
  if (!detail) notFound();
  const { user, access, billing, grants, trackers, payments, audit } = detail;
  const canGrant = can(staff.role, "grants.manage");
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

        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Payments (last 20)">
            {payments.length === 0 ? (
              <p className="text-sm text-fg-muted">None.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {payments.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3 py-1.5">
                    <span>{dateTime(row.createdAt)} · {row.kind}{row.casesDelta ? ` (+${row.casesDelta})` : ""} · {row.provider}</span>
                    <span className="font-medium">{money(row.amount, row.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Admin actions on this account">
            {audit.length === 0 ? (
              <p className="text-sm text-fg-muted">None.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {audit.map((row) => (
                  <li key={row.id} className="py-1.5">
                    <div>{dateTime(row.createdAt)} · <span className="font-medium">{row.action}</span> · {row.actorEmail}</div>
                    {row.details && <div className="break-all font-mono text-xs text-fg-muted">{JSON.stringify(row.details)}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <Stat label="Cases right now" value={`${billing.activeCases} active · ${billing.finishedCases} finished`} />
      </div>
    </>
  );
}
