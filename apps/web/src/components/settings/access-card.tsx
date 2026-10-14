"use client";

import type { AccessState, BillingStateDto, PaymentDto } from "@ojo/core";
import { API_ROUTES, APP_CONFIG, SETTINGS_SECTIONS, casesPrice, type MessageKey } from "@ojo/shared";
import { Alert, Button, Card, TextField } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { formatMoney } from "@/lib/money";

const DAY_MS = 86_400_000;

const PLAN_KEY: Record<AccessState["plan"], MessageKey> = {
  trial: "settings.access.trial",
  trial_expired: "settings.access.trialExpired",
  subscription: "settings.access.subscription",
};

type StubAction = "cancel" | "resetTrial";

interface Props {
  access: AccessState;
  billing: BillingStateDto;
  payments: PaymentDto[];
  stubEnabled: boolean;
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="rounded-xl border border-slate-200 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold ${tone === "warn" && value > 0 ? "text-amber-600" : "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}

/** Subscription page: purchase, slot analytics, amounts and dates, payment log, test buttons. */
export function AccessCard({ access, billing, payments, stubEnabled }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const subscribed = access.plan === "subscription";
  // a running subscription grows by the entered number; without one the number is the whole subscription
  const [count, setCount] = useState(subscribed ? 1 : Math.max(1, billing.keptCases));

  const money = (amount: number) => formatMoney(amount, billing.currency, locale);
  const day = (iso: string | Date) => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(iso));
  const dateTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));
  const until = access.until && subscribed ? new Date(access.until) : null;
  const periodStart = until ? new Date(until.getTime() - APP_CONFIG.limits.subscriptionDays * DAY_MS) : null;

  const minCount = subscribed ? 1 : Math.max(1, billing.keptCases);
  const maxCount = subscribed ? billing.maxCases - billing.paidCases : billing.maxCases;
  const valid = Number.isInteger(count) && count >= minCount && count <= maxCount;
  const target = subscribed ? billing.paidCases + count : count;
  const price = subscribed ? casesPrice(target) - casesPrice(billing.paidCases) : casesPrice(target);
  const cancelledAll = subscribed && billing.activeCases > 0 && billing.keptCases === 0;

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

      <Card title={subscribed ? t("settings.sub.buyTitleMore") : t("settings.sub.buyTitleNew")} description={t(PLAN_KEY[access.plan], { date: access.until ? day(access.until) : "" })}>
        {stubEnabled ? (
          <div className="space-y-3">
            <div className="max-w-xs">
              <TextField
                label={subscribed ? t("settings.sub.addLabel") : t("billing.buy.label")}
                type="number"
                min={minCount}
                max={maxCount}
                value={Number.isNaN(count) ? "" : String(count)}
                onChange={(e) => setCount(e.target.value === "" ? Number.NaN : Number(e.target.value))}
              />
            </div>
            <p className="text-sm text-slate-600">{t("settings.sub.total", { count: valid ? target : 0 })}</p>
            <Button
              disabled={!valid}
              loading={busy === "buy"}
              onClick={() =>
                void run("buy", () =>
                  apiRequest(API_ROUTES.billingCheckout, { method: "POST", body: { cases: target } }),
                )
              }
            >
              {subscribed
                ? t("billing.buy.more", { count: valid ? count : 0, amount: money(valid ? price : 0) })
                : t("billing.buy.start", { count: valid ? count : 0, amount: money(valid ? price : 0) })}
            </Button>
            {subscribed && <p className="text-xs text-slate-500">{t("billing.buy.moreHelp")}</p>}
            <p className="text-xs text-slate-500">{t("billing.buy.limit", { max: billing.maxCases })}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t("billing.paymentSoon")}</p>
        )}
      </Card>

      {subscribed && (
        <Card title={t("settings.sub.slots")}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Tile label={t("settings.sub.bought")} value={billing.paidCases} />
            <Tile label={t("settings.sub.used")} value={billing.activeCases} />
            <Tile label={t("settings.sub.free")} value={billing.freeCases} />
            <Tile label={t("settings.sub.disabledNext")} value={billing.cancelledCases} tone="warn" />
            <Tile label={t("settings.sub.finished")} value={billing.finishedCases} />
            <Tile label={t("settings.sub.paused")} value={billing.pausedCases} />
          </div>
        </Card>
      )}

      <Card title={t("settings.sub.info")}>
        {subscribed && until && periodStart ? (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">{t("settings.sub.sum")}</dt>
                <dd className="text-lg font-semibold text-slate-900">{money(billing.currentPrice)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("settings.sub.started")}</dt>
                <dd className="font-medium text-slate-900">{day(periodStart)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("settings.sub.nextCharge")}</dt>
                <dd className="font-medium text-slate-900">{day(until)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("settings.sub.nextAmount")}</dt>
                <dd className="font-medium text-slate-900">
                  {billing.keptCases > 0
                    ? `${money(billing.nextPeriodPrice)} · ${t("landing.pricing.cases", { count: billing.keptCases })}`
                    : t("billing.cases.nextNone")}
                </dd>
              </div>
            </dl>

            {billing.activeCases > 0 && (
              <div className="space-y-1">
                {cancelledAll ? (
                  <>
                    <p className="text-sm font-medium text-amber-700">{t("billing.cancelledAll", { date: day(until) })}</p>
                    <Button
                      variant="secondary"
                      loading={busy === "resumeAll"}
                      onClick={() =>
                        void run("resumeAll", () =>
                          apiRequest(API_ROUTES.billingSubscription, { method: "PUT", body: { kept: true } }),
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
                      loading={busy === "cancelAll"}
                      onClick={() =>
                        void run("cancelAll", () =>
                          apiRequest(API_ROUTES.billingSubscription, { method: "PUT", body: { kept: false } }),
                        )
                      }
                    >
                      {t("billing.cancelAll")}
                    </Button>
                    <p className="text-xs text-slate-500">{t("billing.cancelAllHelp", { date: day(until) })}</p>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t("settings.sub.noSubscription")}</p>
        )}
      </Card>

      {stubEnabled && (
        <Alert tone="info">
          <div className="space-y-3">
            <p>
              <strong>{t("settings.access.stubTitle")}.</strong> {t("settings.access.stubHelp")}
            </p>
            <div className="flex flex-wrap gap-2">
              {subscribed && billing.keptCases > 0 && (
                <Button
                  loading={busy === "renew"}
                  onClick={() => void run("renew", () => apiRequest(API_ROUTES.billingRenew, { method: "POST" }))}
                >
                  {t("billing.renew", { amount: money(billing.nextPeriodPrice) })}
                </Button>
              )}
              {(["cancel", "resetTrial"] as StubAction[]).map((action) => (
                <Button
                  key={action}
                  variant="secondary"
                  loading={busy === action}
                  onClick={() =>
                    void run(action, () => apiRequest(API_ROUTES.billingStub, { method: "POST", body: { action } }))
                  }
                >
                  {action === "cancel" ? t("settings.access.stubCancel") : t("settings.access.stubReset")}
                </Button>
              ))}
            </div>
          </div>
        </Alert>
      )}

      <Card title={t("billing.history")}>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">{t("billing.historyEmpty")}</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {payments.map((payment) => (
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
        )}
      </Card>
    </div>
  );
}
