"use client";

import type { AccessState, BillingStateDto, FreeGrantDto, PaymentDto, PaymentMethod } from "@ojo/core";
import { API_ROUTES, SETTINGS_SECTIONS, casesPrice, type MessageKey } from "@ojo/shared";
import { Alert, Button, Card, TextField } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { PaymentModal } from "@/components/payments/payment-modal";
import { StatTile } from "@/components/stat-tile";
import { SubscriptionSummary } from "@/components/subscription/summary";
import { formatMoney } from "@/lib/money";

/** Payments shown on one page of the log. */
const LOG_PAGE_SIZE = 10;

interface Props {
  access: AccessState;
  billing: BillingStateDto;
  payments: PaymentDto[];
  /** Free places (trial, bonus, gift): running, upcoming and recently ended. */
  grants: FreeGrantDto[];
  /** Payment methods a provider offers right now (empty: payments are not connected yet). */
  methods: PaymentMethod[];
  /** The test provider is in use: payments are simulated. */
  testMode: boolean;
  /** Number picked on the landing page (cases to buy), if any. */
  initialCount?: number;
  /** Days left of the running period. */
  daysLeft: number;
}

/** Subscription page: purchase, slot analytics, amounts and dates, payment log, test buttons. */
export function AccessCard({ access, billing, payments, grants, methods, testMode, initialCount, daysLeft }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [logPage, setLogPage] = useState(1);
  const logPages = Math.max(1, Math.ceil(payments.length / LOG_PAGE_SIZE));
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const subscribed = access.plan === "subscription";
  // the trial is its own thing: one place for a few days, shown only while it runs
  const trial = !subscribed && access.trialCases > 0;
  // gift places are mentioned only to people who have them
  const giftCases = access.giftCases;
  const giftGrants = grants.filter((grant) => grant.kind !== "TRIAL" && grant.active);
  const giftEnds = giftGrants
    .map((grant) => (grant.expiresAt ? new Date(grant.expiresAt).getTime() : null))
    .filter((value): value is number => value !== null);
  const giftUntil = giftEnds.length > 0 ? Math.min(...giftEnds) : null;
  const trialUsed = Math.min(billing.activeCases, access.trialCases);
  // the server decides which places hold the cases (free ones first); the page only shows it
  const giftUsed = billing.grantedUsedCases;
  const paidUsed = billing.paidUsedCases;
  // a running subscription grows by the entered number; without one the number is the whole subscription
  // without a subscription the number is the whole subscription: it must hold the cases the free places do not cover
  const minBuy = subscribed ? 1 : Math.max(1, billing.nextPeriodCases);
  const maxCount = subscribed ? billing.maxCases - billing.paidCases : billing.maxCases;
  // the field starts at 0 so the figures next to it never look like a pre-chosen purchase
  const [raw, setRaw] = useState(() =>
    initialCount ? String(Math.min(Math.max(initialCount, minBuy), Math.max(0, maxCount))) : "0",
  );
  const count = raw === "" ? 0 : Number(raw);

  /** Only digits are accepted and a number above the limit becomes the limit. */
  function onCountChange(value: string) {
    const digits = value.replace(/\D/g, "");
    setRaw(digits === "" ? "" : String(Math.min(Number(digits), Math.max(0, maxCount))));
  }

  const money = (amount: number) => formatMoney(amount, billing.currency, locale);
  const day = (iso: string | Date) => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(iso));
  const dateTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));
  const until = access.until && subscribed ? new Date(access.until) : null;

  const valid = count >= minBuy && count <= maxCount;
  const target = subscribed ? billing.paidCases + count : count;
  const price = subscribed ? casesPrice(target) - casesPrice(billing.paidCases) : casesPrice(target);
  // what the subscription holds now: without one (free places only, or none) it holds nothing
  const currentTotal = subscribed ? billing.paidCases : 0;
  // the places bought now stay empty until cases are added to them, so they count as unused
  const added = subscribed && valid ? count : 0;
  const nowTotal = subscribed ? billing.paidCases + added : currentTotal;
  const leaves = subscribed
    ? [
        { key: "marked", label: t("settings.sub.leaves.marked"), value: billing.leavesMarked },
        { key: "finished", label: t("settings.sub.leaves.finished"), value: billing.freedByFinished },
        { key: "unused", label: t("settings.sub.leaves.unused"), value: billing.unusedCases + added },
      ].filter((row) => row.value > 0)
    : [];
  // paid places the next period is charged for: what the cases that stay need beyond the free places
  const nextTotal = subscribed ? billing.nextPeriodCases : valid ? target : currentTotal;
  // cancelled = it will not renew; the cases keep running until the paid period ends
  const cancelled = subscribed && !billing.renews;

  async function run(name: string, action: () => Promise<unknown>) {
    setBusy(name);
    setError("");
    try {
      await action();
      router.refresh();
    } catch (e) {
      setError(describeApiError(e, t));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div id={SETTINGS_SECTIONS.subscription} className="space-y-6">
      {error && <Alert tone="error">{error}</Alert>}

      <Card title={t("settings.sub.statusTitle")}>
        {subscribed && until ? (
          <SubscriptionSummary
            billing={billing}
            untilIso={access.until!}
            daysLeft={daysLeft}
            lastPayment={payments[0] ?? null}
            withPlaces={false}
            withLastPayment={false}
          />
        ) : trial ? (
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">
              {t("settings.access.trial", { date: access.until ? day(access.until) : "" })}
            </p>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">{t("settings.sub.trialLeft")}</dt>
                <dd className="font-medium text-slate-900">{Math.max(0, daysLeft)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("settings.sub.trialUsage")}</dt>
                <dd className="font-medium text-slate-900">
                  {trialUsed > 0 ? t("settings.sub.trialUsed") : t("settings.sub.trialFree")}
                </dd>
              </div>
            </dl>
            <p className="text-slate-500">{t("settings.sub.trialNote")}</p>
          </div>
        ) : giftCases > 0 ? (
          <p className="text-sm text-slate-700">{t("settings.sub.giftOnly")}</p>
        ) : (
          <p className="text-sm text-slate-700">
            {t(access.endedKind && access.endedKind !== "TRIAL" ? "settings.sub.giftEnded" : "settings.sub.trialEnded")}
          </p>
        )}
      </Card>

      {trial && (
        <Card title={t("settings.sub.trialTitle")}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label={t("settings.sub.trialPlaces")} value={access.trialCases} tone="slots" />
            <StatTile label={t("settings.sub.used")} value={trialUsed} tone="finished" />
            <StatTile label={t("settings.sub.free")} value={access.trialCases - trialUsed} tone="tracking" />
            <StatTile label={t("settings.sub.trialStops")} value={billing.activeCases} tone="removing" />
          </div>
        </Card>
      )}

      {giftCases > 0 && (
        <Card title={t("settings.sub.giftTitle")} description={t("settings.sub.giftNote")}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label={t("settings.sub.giftPlaces")} value={giftCases} tone="slots" />
            <StatTile
              label={t("settings.sub.giftUntil")}
              value={giftUntil === null ? t("settings.sub.giftNoEnd") : day(new Date(giftUntil))}
              hint={giftUntil === null ? t("settings.sub.giftNoEndHint") : undefined}
            />
            <StatTile label={t("settings.sub.used")} value={giftUsed} tone="finished" />
            <StatTile label={t("settings.sub.free")} value={giftCases - giftUsed} tone="tracking" />
          </div>
        </Card>
      )}

      {!trial && (
        <Card title={t("settings.sub.slots")}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatTile label={t("settings.sub.bought")} value={billing.paidCases} tone="slots" />
            <StatTile label={t("settings.sub.used")} value={paidUsed} tone="finished" />
            <StatTile label={t("settings.sub.free")} value={Math.max(0, billing.paidCases - paidUsed)} tone="tracking" />
            <StatTile label={t("settings.sub.disabledNext")} value={billing.cancelledCases} tone="removing" />
            <StatTile label={t("settings.sub.finishedPeriod")} value={billing.finishedThisPeriod} tone="finished" />
            <StatTile label={t("settings.sub.finishedTotal")} value={billing.finishedCases} />
          </div>
        </Card>
      )}

      <Card
        title={subscribed ? t("settings.sub.addTitle") : t("settings.sub.buyTitleNew")}
      >
        <div className="space-y-5">
          {methods.length === 0 ? (
            <Alert tone="info">{t("pay.unavailable")}</Alert>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <TextField
                  label={subscribed ? t("settings.sub.addLabel") : t("billing.buy.label")}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={raw}
                  onChange={(e) => onCountChange(e.target.value)}
                  onBlur={() => raw === "" && setRaw("0")}
                />
                <p className="text-xs text-slate-500">{t("billing.buy.limit", { max: billing.maxCases })}</p>
                {subscribed && <p className="text-xs text-slate-500">{t("billing.buy.moreHelp")}</p>}
                {!subscribed && count > 0 && count < minBuy && (
                  <p className="text-xs text-amber-700">{t("settings.sub.minHint", { min: minBuy })}</p>
                )}
              </div>
              <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{t("settings.sub.nowHave")}</span>
                  <span className="font-medium text-slate-900">{nowTotal}</span>
                </div>
                {leaves.map((row) => (
                  <div key={row.key} className="flex justify-between gap-3 pl-3 text-xs">
                    <span className="text-slate-500">{row.label}</span>
                    <span className="font-medium text-slate-700">−{row.value}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{t("settings.sub.willHave")}</span>
                  <span className="font-medium text-slate-900">{nextTotal}</span>
                </div>
                {subscribed && <p className="text-xs text-slate-500">{t("settings.sub.leaves.help")}</p>}
                {giftCases > 0 && (
                  <p className="text-xs text-slate-500">{t("settings.sub.giftFirst", { count: giftCases })}</p>
                )}
                <div className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-3">
                  <span className="text-slate-600">{t("settings.sub.toPay")}</span>
                  <span className="text-xl font-bold text-slate-900">{money(valid ? price : 0)}</span>
                </div>
                <Button fullWidth disabled={!valid || price <= 0} onClick={() => setPaying(true)}>
                  {t("settings.sub.buyNow")}
                </Button>
              </div>
            </div>
          )}

        </div>
      </Card>

      {paying && (
      <PaymentModal
        open
        onClose={() => setPaying(false)}
        onPaid={() => router.refresh()}
        targetCases={valid ? target : currentTotal}
        addCases={valid ? (subscribed ? count : target) : 0}
        amount={valid ? price : 0}
        currency={billing.currency}
        subscribed={subscribed}
        methods={methods}
        testMode={testMode}
      />
      )}

      {!(subscribed && until) && (
        <Card title={t("settings.sub.manageTitle")}>
          <p className="text-sm text-slate-500">{t("settings.sub.manageNone")}</p>
        </Card>
      )}

      {subscribed && until && (
        <Card
          title={t("settings.sub.manageTitle")}
          description={t("settings.access.subscription", { date: day(until) })}
        >
          <div className="space-y-5">
            <div className="space-y-1">
                {cancelled ? (
                  <>
                    <p className="text-sm font-medium text-amber-700">{t("billing.cancelledAll", { date: day(until) })}</p>
                    <Button
                      variant="secondary"
                      loading={busy === "resume"}
                      onClick={() =>
                        void run("resume", () =>
                          apiRequest(API_ROUTES.billingSubscription, { method: "PUT", body: { renew: true } }),
                        )
                      }
                    >
                      {t("billing.resumeAll")}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      loading={busy === "cancel-subscription"}
                      onClick={() =>
                        void run("cancel-subscription", () =>
                          apiRequest(API_ROUTES.billingSubscription, { method: "PUT", body: { renew: false } }),
                        )
                      }
                    >
                      {t("billing.cancelAll")}
                    </Button>
                    <p className="text-xs text-slate-500">{t("billing.cancelAllHelp", { date: day(until) })}</p>
                  </>
                )}
              </div>

            {testMode && (
              <details className="border-t border-slate-100 pt-3 text-sm">
                <summary className="cursor-pointer text-slate-500">{t("settings.access.testActions")}</summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {subscribed && billing.renews && billing.keptCases > 0 && (
                    <Button
                      variant="ghost"
                      loading={busy === "renew"}
                      onClick={() => void run("renew", () => apiRequest(API_ROUTES.billingRenew, { method: "POST" }))}
                    >
                      {t("billing.renew", { amount: money(billing.nextPeriodPrice) })}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    loading={busy === "cancel"}
                    onClick={() =>
                      void run("cancel", () =>
                        apiRequest(API_ROUTES.billingStub, { method: "POST", body: { action: "cancel" } }),
                      )
                    }
                  >
                    {t("settings.access.stubCancel")}
                  </Button>
                </div>
              </details>
            )}
          </div>
        </Card>
      )}

      <Card title={t("billing.history")}>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">{t("billing.historyEmpty")}</p>
        ) : (
          <div className="space-y-3">
            <ul className="divide-y divide-slate-100 text-sm">
              {payments.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE).map((payment) => (
                <li key={payment.id} className="flex justify-between gap-3 py-2 text-slate-700">
                  <span>
                    {dateTime(payment.createdAt)} ·{" "}
                    {t(`billing.kind.${payment.kind}` as MessageKey, { count: payment.casesDelta })}
                    <span className="text-slate-400"> ({t("billing.stubBadge")})</span>
                  </span>
                  <span className="font-medium">{formatMoney(payment.amount, payment.currency, locale)}</span>
                </li>
              ))}
            </ul>
              <nav aria-label={t("dash.table.pages")} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">
                  {t("dash.table.range", {
                    from: (logPage - 1) * LOG_PAGE_SIZE + 1,
                    to: Math.min(logPage * LOG_PAGE_SIZE, payments.length),
                    total: payments.length,
                  })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={logPage <= 1}
                    onClick={() => setLogPage(logPage - 1)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                  >
                    ←
                  </button>
                  {Array.from({ length: logPages }, (_, index) => index + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-current={n === logPage ? "page" : undefined}
                      onClick={() => setLogPage(n)}
                      className={`rounded-lg border px-3 py-1.5 ${
                        n === logPage ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={logPage >= logPages}
                    onClick={() => setLogPage(logPage + 1)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                  >
                    →
                  </button>
                </div>
              </nav>
          </div>
        )}
      </Card>
    </div>
  );
}
