"use client";

import type { AccessState, BillingStateDto, PaymentDto, QuoteDto } from "@ojo/core";
import { API_ROUTES, type MessageKey } from "@ojo/shared";
import { Alert, Button, Card } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";

const PLAN_KEY: Record<AccessState["plan"], MessageKey> = {
  none: "settings.access.none",
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

/** Subscription status, price breakdown, payment history and the test payment buttons. */
export function AccessCard({ access, billing, payments, stubEnabled }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const money = (amount: number) => formatMoney(amount, billing.currency, locale);
  const longDate = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(iso));
  const date = access.until ? longDate(access.until) : "";
  const subscribed = access.plan === "subscription";

  async function run(name: string, action: () => Promise<unknown>) {
    setBusy(name);
    try {
      await action();
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card id="subscription" title={t("settings.access.title")}>
      <div className="space-y-4">
        <div className="space-y-1 text-sm text-slate-700">
          <p>{t(PLAN_KEY[access.plan], { date })}</p>
          <p className="text-slate-500">{t("billing.price", { amount: money(billing.perUser) })}</p>
          {subscribed && (
            <>
              <p>{t("billing.seats", { count: billing.seats })}</p>
              <p>{t("billing.renewal", { date })}</p>
              <p>
                {t("billing.nextPrice", { amount: money(billing.nextPeriodPrice), users: 1 + billing.seats })}
              </p>
            </>
          )}
        </div>

        {stubEnabled ? (
          <Alert tone="info">
            <div className="space-y-3">
              <p>
                <strong>{t("settings.access.stubTitle")}.</strong> {t("settings.access.stubHelp")}
              </p>
              <div className="flex flex-wrap gap-2">
                {!subscribed ? (
                  <Button
                    loading={busy === "subscribe"}
                    onClick={() =>
                      void run("subscribe", () =>
                        apiRequest<{ quote: QuoteDto }>(API_ROUTES.billingCheckout, {
                          method: "POST",
                          body: { addSeats: 0 },
                        }),
                      )
                    }
                  >
                    {t("billing.subscribe", { amount: money(billing.perUser * (1 + billing.seats)) })}
                  </Button>
                ) : (
                  <Button
                    loading={busy === "renew"}
                    onClick={() => void run("renew", () => apiRequest(API_ROUTES.billingRenew, { method: "POST" }))}
                  >
                    {t("billing.renew", { amount: money(billing.nextPeriodPrice) })}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  loading={busy === "cancel"}
                  onClick={() =>
                    void run("cancel", () =>
                      apiRequest(API_ROUTES.billingStub, { method: "POST", body: { action: "cancel" satisfies StubAction } }),
                    )
                  }
                >
                  {t("settings.access.stubCancel")}
                </Button>
                <Button
                  variant="secondary"
                  loading={busy === "resetTrial"}
                  onClick={() =>
                    void run("resetTrial", () =>
                      apiRequest(API_ROUTES.billingStub, {
                        method: "POST",
                        body: { action: "resetTrial" satisfies StubAction },
                      }),
                    )
                  }
                >
                  {t("settings.access.stubReset")}
                </Button>
              </div>
            </div>
          </Alert>
        ) : (
          !subscribed && <p className="text-sm text-slate-500">{t("billing.paymentSoon")}</p>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">{t("billing.history")}</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-500">{t("billing.historyEmpty")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {payments.map((payment) => (
                <li key={payment.id} className="flex justify-between gap-3 text-slate-700">
                  <span>
                    {longDate(payment.createdAt)} ·{" "}
                    {t(`billing.kind.${payment.kind}` as MessageKey, { count: payment.seatsDelta })}
                    <span className="text-slate-400"> ({t("billing.stubBadge")})</span>
                  </span>
                  <span className="font-medium">{money(payment.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
