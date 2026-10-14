"use client";

import type { BillingStateDto } from "@ojo/core";
import { APP_CONFIG } from "@ojo/shared";
import { useI18n } from "@/components/providers/i18n-provider";
import { formatMoney } from "@/lib/money";

const DAY_MS = 86_400_000;

/**
 * Where the subscription stands: how many paid places are used, the period and its amounts.
 * One component for the dashboard and the subscription page, so they always say the same.
 */
export function SubscriptionSummary({
  billing,
  untilIso,
  daysLeft,
  lastPayment,
  withPlaces = true,
  withLastPayment = true,
}: {
  billing: BillingStateDto;
  /** End of the running period (ISO). */
  untilIso: string;
  daysLeft: number;
  lastPayment: { createdAt: string; amount: number; currency: string } | null;
  /** Free / disabled / finished counts (left out where tiles already show them). */
  withPlaces?: boolean;
  /** The last payment line (left out where the payment log is shown right below). */
  withLastPayment?: boolean;
}) {
  const { t, locale } = useI18n();
  const money = (amount: number) => formatMoney(amount, billing.currency, locale);
  const day = (value: string | number) => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(value));
  const until = new Date(untilIso).getTime();
  const start = until - APP_CONFIG.limits.subscriptionDays * DAY_MS;
  const share = billing.paidCases > 0 ? Math.min(100, Math.round((billing.activeCases / billing.paidCases) * 100)) : 0;

  const item = (label: string, value: string, key: string) => (
    <div key={key}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-slate-600">{t("dash.sub.usage")}</span>
          <span className="font-medium text-slate-900">
            {billing.activeCases} / {billing.paidCases}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${share}%` }} />
        </div>
      </div>
      <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {item(t("settings.sub.started"), day(start), "started")}
        {item(
          billing.renews ? t("settings.sub.nextCharge") : t("settings.sub.validUntil"),
          `${day(until)} (${t("dash.sub.daysLeft", { count: Math.max(0, daysLeft) })})`,
          "next",
        )}
        {item(t("settings.sub.sum"), money(billing.currentPrice), "sum")}
        {item(
          t("settings.sub.nextAmount"),
          !billing.renews
            ? t("billing.cases.cancelledNext")
            : billing.keptCases > 0
              ? money(billing.nextPeriodPrice)
              : t("billing.cases.nextNone"),
          "nextAmount",
        )}
        {withPlaces && item(t("dash.sub.free"), String(billing.freeCases), "free")}
        {withPlaces && item(t("settings.sub.disabledNext"), String(billing.cancelledCases), "disabled")}
        {withPlaces && item(t("settings.sub.finished"), String(billing.finishedCases), "finished")}
        {withLastPayment && item(
          t("dash.sub.lastPayment"),
          lastPayment
            ? `${day(lastPayment.createdAt)} · ${formatMoney(lastPayment.amount, lastPayment.currency, locale)}`
            : "—",
          "last",
        )}
      </dl>
    </div>
  );
}
