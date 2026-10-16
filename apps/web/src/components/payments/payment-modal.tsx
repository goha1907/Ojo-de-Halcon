"use client";

import type { PaymentIntentDto, PaymentMethod } from "@ojo/core";
import { API_ROUTES, APP_CONFIG, type MessageKey } from "@ojo/shared";
import { Alert, Button, Modal, Spinner, TextField } from "@ojo/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { nowMs } from "@/lib/days";
import { formatMoney } from "@/lib/money";
import { expiryValid, luhnValid, tokenizeCard } from "./card-tokenizer";
import { FakeQr } from "./fake-qr";

type Step = "method" | "qr" | "card" | "processing" | "success" | "failed";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after a successful payment, when the window is dismissed. */
  onPaid: () => void;
  /** Cases the subscription holds after paying, and how many of them are bought now. */
  targetCases: number;
  addCases: number;
  amount: number;
  currency: string;
  /** A subscription exists already: the payment is an addition. */
  subscribed: boolean;
  methods: PaymentMethod[];
  /** The test provider is in use: payments are simulated and the window says so. */
  testMode: boolean;
}

const METHOD_ORDER: PaymentMethod[] = ["mercadopago_qr", "card"];

/**
 * The payment window: choose how to pay, pay (QR or card), wait, done. The same window serves
 * the first subscription and every top-up, and it talks only to /api/payments, so connecting
 * a real provider does not change it (only `card-tokenizer.ts` and the QR payload do).
 * Mount it when the payment starts (a fresh window each time) and unmount it when it closes.
 */
export function PaymentModal({
  open,
  onClose,
  onPaid,
  targetCases,
  addCases,
  amount,
  currency,
  subscribed,
  methods,
  testMode,
}: Props) {
  const { t, locale } = useI18n();
  const [step, setStep] = useState<Step>("method");
  const [intent, setIntent] = useState<PaymentIntentDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failure, setFailure] = useState("");
  const [card, setCard] = useState({ number: "", holder: "", expiry: "", cvc: "" });
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const intentRef = useRef<PaymentIntentDto | null>(null);
  useEffect(() => {
    intentRef.current = intent;
  }, [intent]);

  const apply = useCallback((next: PaymentIntentDto) => {
    setIntent(next);
    if (next.status === "SUCCEEDED") setStep("success");
    else if (next.status === "FAILED" || next.status === "EXPIRED" || next.status === "CANCELLED") {
      setFailure(next.status === "EXPIRED" ? "expired" : (next.failureReason ?? "generic"));
      setStep("failed");
    } else if (next.status === "PROCESSING") setStep((current) => (current === "card" ? "processing" : current));
  }, []);

  // while a payment is open, ask how it is going
  useEffect(() => {
    if (!open || !intent || !["qr", "processing"].includes(step)) return;
    const timer = setInterval(() => {
      void apiRequest<{ intent: PaymentIntentDto }>(`${API_ROUTES.paymentIntents}/${intent.id}`)
        .then((result) => apply(result.intent))
        .catch(() => undefined);
    }, APP_CONFIG.payments.pollIntervalMs);
    return () => clearInterval(timer);
  }, [open, intent, step, apply]);

  async function choose(method: PaymentMethod) {
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{ intent: PaymentIntentDto }>(API_ROUTES.paymentIntents, {
        method: "POST",
        body: { cases: targetCases, method },
      });
      setIntent(result.intent);
      setStep(method === "card" ? "card" : "qr");
    } catch (e) {
      setError(describeApiError(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function payByCard() {
    if (!intent) return;
    const errors: Record<string, string> = {};
    if (!luhnValid(card.number)) errors.number = t("pay.error.number");
    if (!card.holder.trim()) errors.holder = t("pay.error.holder");
    if (!expiryValid(card.expiry, new Date())) errors.expiry = t("pay.error.expiry");
    if (!/^\d{3,4}$/.test(card.cvc)) errors.cvc = t("pay.error.cvc");
    setCardErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setBusy(true);
    setError("");
    try {
      // the card goes to the provider (its form); only a token comes to our server
      const token = await tokenizeCard(card);
      const result = await apiRequest<{ intent: PaymentIntentDto }>(
        `${API_ROUTES.paymentIntents}/${intent.id}/card`,
        { method: "POST", body: { token } },
      );
      setStep("processing");
      apply(result.intent);
    } catch (e) {
      setError(describeApiError(e, t));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    const current = intentRef.current;
    if (current && ["PENDING", "PROCESSING"].includes(current.status) && step !== "success") {
      void apiRequest(`${API_ROUTES.paymentIntents}/${current.id}/cancel`, { method: "POST" }).catch(() => undefined);
    }
    onClose();
    if (step === "success") onPaid();
  }

  const money = formatMoney(amount, currency, locale);
  const minutesLeft = intent ? Math.max(0, Math.ceil((new Date(intent.expiresAt).getTime() - nowMs()) / 60_000)) : 0;
  const ordered = METHOD_ORDER.filter((method) => methods.includes(method));
  const field = (key: keyof typeof card, value: string) => setCard((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      open={open}
      onClose={close}
      title={subscribed ? t("pay.title.more") : t("pay.title.new")}
      closeLabel={t("common.cancel")}
      className="w-[min(30rem,calc(100vw-2rem))]"
    >
      <div className="space-y-5">
        {step !== "success" && (
          <div className="rounded-field bg-line/40 px-4 py-3 text-sm">
            <div className="flex justify-between gap-3 text-fg-muted">
              <span>{subscribed ? t("pay.summary.add", { count: addCases }) : t("pay.summary.cases", { count: targetCases })}</span>
              {subscribed && <span>{t("pay.summary.total", { count: targetCases })}</span>}
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="text-fg-muted">{t("pay.summary.amount")}</span>
              <span className="text-xl font-bold text-fg">{money}</span>
            </div>
          </div>
        )}

        {error && <Alert tone="error">{error}</Alert>}

        {step === "method" && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-fg">{t("pay.method.title")}</h3>
            {ordered.map((method) => (
              <button
                key={method}
                type="button"
                disabled={busy}
                onClick={() => void choose(method)}
                className="flex w-full items-center justify-between gap-3 rounded-field border border-line px-4 py-3 text-left hover:border-fg-subtle hover:bg-line/40 disabled:opacity-60"
              >
                <span>
                  <span className="block font-medium text-fg">{t(`pay.method.${method}` as MessageKey)}</span>
                  <span className="block text-xs text-fg-muted">{t(`pay.method.${method}.hint` as MessageKey)}</span>
                </span>
                <span aria-hidden="true" className="text-fg-subtle">→</span>
              </button>
            ))}
            {testMode && <p className="text-xs text-fg-muted">{t("pay.testMode")}</p>}
          </div>
        )}

        {step === "qr" && intent && (
          <div className="flex flex-col items-center gap-3 text-center">
            <h3 className="text-sm font-semibold text-fg">{t("pay.qr.title")}</h3>
            <FakeQr payload={intent.qrPayload ?? intent.id} />
            <p className="text-sm text-fg-muted">{t("pay.qr.text")}</p>
            <p className="flex items-center gap-2 text-sm text-fg-muted">
              <Spinner className="size-4 text-fg-muted" /> {t("pay.qr.waiting")}
            </p>
            <p className="text-xs text-fg-muted">{t("pay.qr.expires", { minutes: minutesLeft })}</p>
            {testMode && <p className="text-xs text-fg-muted">{t("pay.qr.placeholder")}</p>}
          </div>
        )}

        {step === "card" && intent && (
          <form
            noValidate
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void payByCard();
            }}
          >
            <h3 className="text-sm font-semibold text-fg">{t("pay.card.title")}</h3>
            <TextField
              label={t("pay.card.number")}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              value={card.number}
              error={cardErrors.number}
              onChange={(e) =>
                field("number", e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim())
              }
            />
            <TextField
              label={t("pay.card.holder")}
              autoComplete="cc-name"
              value={card.holder}
              error={cardErrors.holder}
              onChange={(e) => field("holder", e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label={t("pay.card.expiry")}
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                value={card.expiry}
                error={cardErrors.expiry}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                  field("expiry", digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
                }}
              />
              <TextField
                label={t("pay.card.cvc")}
                inputMode="numeric"
                autoComplete="cc-csc"
                maxLength={4}
                value={card.cvc}
                error={cardErrors.cvc}
                onChange={(e) => field("cvc", e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <p className="text-xs text-fg-muted">{t("pay.card.secure")}</p>
            {testMode && <p className="text-xs text-fg-muted">{t("pay.card.test")}</p>}
            <Button type="submit" fullWidth loading={busy}>
              {t("pay.card.submit", { amount: money })}
            </Button>
          </form>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Spinner className="size-8 text-fg" />
            <h3 className="text-base font-semibold text-fg">{t("pay.processing.title")}</h3>
            <p className="text-sm text-fg-muted">{t("pay.processing.text")}</p>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-3xl text-success-fg">
              ✓
            </span>
            <h3 className="text-lg font-semibold text-fg">{t("pay.success.title")}</h3>
            <p className="text-sm text-fg-muted">
              {subscribed ? t("pay.success.textMore") : t("pay.success.text")} {money}
            </p>
            <Button onClick={close}>{t("pay.success.done")}</Button>
          </div>
        )}

        {step === "failed" && (
          <div className="space-y-4">
            <Alert tone="error">
              <strong>{t("pay.failed.title")}.</strong>{" "}
              {t(
                (["card_declined", "expired"].includes(failure) ? `pay.failed.${failure}` : "pay.failed.generic") as MessageKey,
              )}
            </Alert>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => {
                  setIntent(null);
                  setFailure("");
                  setStep("method");
                }}
              >
                {t("pay.failed.retry")}
              </Button>
            </div>
          </div>
        )}

        {(step === "qr" || step === "card") && (
          <div className="flex justify-between border-t border-line pt-3">
            <Button
              variant="ghost"
              onClick={() => {
                const current = intentRef.current;
                if (current) void apiRequest(`${API_ROUTES.paymentIntents}/${current.id}/cancel`, { method: "POST" }).catch(() => undefined);
                setIntent(null);
                setStep("method");
              }}
            >
              {t("pay.back")}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
