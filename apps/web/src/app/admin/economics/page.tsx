import { dateOnly, money } from "@/components/admin/format";
import { PageTitle, Panel, Stat, TABLE, TD, TH } from "@/components/admin/ui";
import { getCore } from "@/server/core";
import { requireStaff } from "@/server/session";

export default async function AdminEconomicsPage() {
  await requireStaff("economics.read");
  const data = await getCore().admin.economics(12);
  const total = (rows: { real: number; test: number }[]) => ({
    real: rows.reduce((n, row) => n + row.real, 0),
    test: rows.reduce((n, row) => n + row.test, 0),
  });
  const year = total(data.byMonth);
  return (
    <>
      <PageTitle title="Economics" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Estimated monthly revenue" value={money(data.estimatedMonthly, data.currency)} hint="Running subscriptions, by the price ladder" />
        <Stat href="/admin/users?plan=subscription" label="Running subscriptions" value={data.running} hint={`${data.paidPlaces} paid places`} />
        <Stat label="Average per subscription" value={money(data.averagePerSubscription, data.currency)} hint="Per month" />
        <Stat href="/admin/users?gift=yes" label="Bonus places in use" value={data.giftPlaces} hint={`Worth ${money(data.giftValue, data.currency)} a month at the price ladder`} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title="Paid by month" note="Payments of the last 12 months. Test payments (stub provider) are shown apart and are not money.">
          <table className={TABLE}>
            <thead><tr><th className={TH}>Month</th><th className={TH}>Payments</th><th className={TH}>Received</th><th className={TH}>Test</th></tr></thead>
            <tbody>
              {data.byMonth.map((row) => (
                <tr key={row.month} className="border-t border-line">
                  <td className={TD}>{row.month}</td>
                  <td className={TD}>{row.count}</td>
                  <td className={`${TD} font-medium`}>{money(row.real, data.currency)}</td>
                  <td className={`${TD} text-fg-muted`}>{money(row.test, data.currency)}</td>
                </tr>
              ))}
              {data.byMonth.length === 0 && <tr><td className={`${TD} text-fg-muted`} colSpan={4}>No payments yet.</td></tr>}
              {data.byMonth.length > 0 && (
                <tr className="border-t border-line font-semibold">
                  <td className={TD}>Total</td><td className={TD} />
                  <td className={TD}>{money(year.real, data.currency)}</td>
                  <td className={`${TD} text-fg-muted`}>{money(year.test, data.currency)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
        <Panel title="By kind of payment" note="All time.">
          <table className={TABLE}>
            <thead><tr><th className={TH}>Kind</th><th className={TH}>Payments</th><th className={TH}>Received</th><th className={TH}>Test</th></tr></thead>
            <tbody>
              {data.byKind.map((row) => (
                <tr key={row.kind} className="border-t border-line">
                  <td className={TD}>{row.kind}</td>
                  <td className={TD}>{row.count}</td>
                  <td className={`${TD} font-medium`}>{money(row.real, data.currency)}</td>
                  <td className={`${TD} text-fg-muted`}>{money(row.test, data.currency)}</td>
                </tr>
              ))}
              {data.byKind.length === 0 && <tr><td className={`${TD} text-fg-muted`} colSpan={4}>No payments yet.</td></tr>}
            </tbody>
          </table>
        </Panel>
      </div>
      <p className="mt-4 text-xs text-fg-muted">Figures are in {data.currency}. Taxes, provider fees and refunds are not subtracted: add them when real billing is connected. Updated {dateOnly(new Date().toISOString())}.</p>
    </>
  );
}
