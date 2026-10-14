"use client";

import type { BillingStateDto, PersonDto, QuoteDto } from "@ojo/core";
import { API_ROUTES, APP_CONFIG, ROUTES, findJurisdiction } from "@ojo/shared";
import { Alert, Button, Card, CheckboxField, SelectField } from "@ojo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { ProfileFields, useProfileFields } from "@/components/profile/profile-fields";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { issuesToFieldErrors } from "@/lib/form-errors";
import { formatMoney } from "@/lib/money";

const EMPTY = { firstName: null, lastName: null, birthDate: null, pjnJurisdiction: null };

interface Props {
  people: PersonDto[];
  billing: BillingStateDto;
  /** A subscription period is running (relatives need one). */
  subscribed: boolean;
  /** Payments are simulated (PAYMENTS_STUB). */
  stubEnabled: boolean;
}

type Step =
  | { name: "idle" }
  | { name: "count" }
  | { name: "pay"; count: number; quote: QuoteDto | null }
  | { name: "forms"; count: number; done: number }
  | { name: "slots" };

/** One relative's form; reports success to the wizard. */
function RelativeForm({
  index,
  total,
  onAdded,
}: {
  index: number;
  total: number;
  onAdded: () => void;
}) {
  const { t } = useI18n();
  const form = useProfileFields(EMPTY, { relative: true });
  const [consent, setConsent] = useState(false);
  const [notify, setNotify] = useState(true);
  const [consentError, setConsentError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const payload = form.validate();
    if (!consent) setConsentError(t("validation.personConsent"));
    if (!payload || !consent) return;
    setConsentError("");
    setBusy(true);
    try {
      await apiRequest(API_ROUTES.people, {
        method: "POST",
        body: { ...payload, notifyTelegram: notify },
      });
      onAdded();
    } catch (e) {
      if (e instanceof ApiError && e.code === "VALIDATION") form.setErrors(issuesToFieldErrors(e.issues, t));
      else if (e instanceof ApiError && e.code === "SLOT_REQUIRED") setError(t("people.slotRequired"));
      else setError(describeApiError(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-lg border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-900">
        {t("people.wizard.person", { n: index + 1, total })}
      </h3>
      {error && <Alert tone="error">{error}</Alert>}
      <ProfileFields state={form} />
      <CheckboxField
        label={t("people.notify")}
        checked={notify}
        onChange={(e) => setNotify(e.target.checked)}
      />
      <CheckboxField
        label={t("people.consent")}
        checked={consent}
        error={consentError}
        onChange={(e) => setConsent(e.target.checked)}
      />
      <Button type="submit" loading={busy}>
        {t("people.save")}
      </Button>
    </form>
  );
}

/** Relatives the owner tracks: slots are paid first, people are added afterwards. */
export function PeopleCard({ people, billing, subscribed, stubEnabled }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "idle" });
  const [count, setCount] = useState(1);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newSeats, setNewSeats] = useState(billing.seats);
  const [remove, setRemove] = useState<Set<string>>(new Set());

  const money = (amount: number, currency = billing.currency) => formatMoney(amount, currency, locale);
  const maxAdd = Math.max(0, APP_CONFIG.limits.maxPeople - people.length);
  const countOptions = useMemo(
    () => Array.from({ length: maxAdd }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
    [maxAdd],
  );

  function fail(e: unknown) {
    if (e instanceof ApiError && e.code === "LIMIT_REACHED") {
      setError(t("billing.error.limit", { max: APP_CONFIG.limits.maxPeople }));
    } else setError(describeApiError(e, t));
  }

  async function startCount() {
    setError("");
    const needBuy = Math.max(0, count - billing.freeSeats);
    if (needBuy === 0 && subscribed) {
      setAdded(new Set());
      setStep({ name: "forms", count, done: 0 });
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest<{ quote: QuoteDto }>(API_ROUTES.billingQuote, {
        method: "POST",
        body: { addSeats: needBuy },
      });
      setStep({ name: "pay", count, quote: result.quote });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function pay(quote: QuoteDto, wanted: number) {
    setError("");
    setBusy(true);
    try {
      await apiRequest(API_ROUTES.billingCheckout, { method: "POST", body: { addSeats: quote.addSeats } });
      setAdded(new Set());
      setStep({ name: "forms", count: wanted, done: 0 });
      router.refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  function personAdded(index: number, total: number) {
    const next = new Set(added).add(index);
    setAdded(next);
    router.refresh();
    if (next.size === total) setStep({ name: "idle" });
  }

  async function toggleNotify(id: string, notifyTelegram: boolean) {
    setError("");
    try {
      await apiRequest(`${API_ROUTES.people}/${id}`, { method: "PATCH", body: { notifyTelegram } });
      router.refresh();
    } catch (e) {
      fail(e);
    }
  }

  const surplus = Math.max(0, people.length - newSeats);
  async function reduce() {
    setError("");
    setBusy(true);
    try {
      await apiRequest(API_ROUTES.billingSeats, {
        method: "PUT",
        body: { seats: newSeats, removePersonIds: [...remove] },
      });
      setStep({ name: "idle" });
      setRemove(new Set());
      router.refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  function toPayText(quote: QuoteDto): string {
    const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(quote.periodEnd));
    const amount = money(quote.amount, quote.currency);
    return quote.mode === "prorated"
      ? t("people.wizard.toPayProrated", { amount, date })
      : t("people.wizard.toPayNew", { amount, date });
  }

  return (
    <Card title={t("people.title")} description={t("people.help", { max: APP_CONFIG.limits.maxPeople })}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {people.length === 0 && step.name === "idle" && (
          <p className="text-sm text-slate-500">{t("people.empty")}</p>
        )}
        <ul className="space-y-2">
          {people.map((person) => (
            <li
              key={person.id}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <span className="font-medium text-slate-900">
                {person.firstName} {person.lastName}
              </span>
              <span className="ml-2 text-slate-500">
                {person.birthDate}
                {person.pjnJurisdiction && ` · ${findJurisdiction(person.pjnJurisdiction)?.code ?? ""}`}
              </span>
              <CheckboxField
                label={t("people.notify")}
                checked={person.notifyTelegram}
                onChange={(e) => void toggleNotify(person.id, e.target.checked)}
              />
            </li>
          ))}
        </ul>
        {subscribed && (
          <p className="text-xs text-slate-500">
            {t("people.seatsInfo", { seats: billing.seats, free: billing.freeSeats })}
          </p>
        )}

        {step.name === "idle" && (
          <div className="flex flex-wrap gap-2">
            {maxAdd === 0 ? (
              <Alert tone="info">{t("people.limit", { max: APP_CONFIG.limits.maxPeople })}</Alert>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  setCount(1);
                  setError("");
                  setStep({ name: "count" });
                }}
              >
                {t("people.wizard.add")}
              </Button>
            )}
            {subscribed && billing.seats > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  setNewSeats(billing.seats);
                  setRemove(new Set());
                  setError("");
                  setStep({ name: "slots" });
                }}
              >
                {t("people.slots.change")}
              </Button>
            )}
          </div>
        )}

        {step.name === "count" && (
          <div className="space-y-4 border-t border-slate-200 pt-4">
            <SelectField
              label={t("people.wizard.count")}
              value={String(count)}
              options={countOptions}
              onChange={(e) => setCount(Number(e.target.value))}
            />
            {subscribed && (
              <p className="text-sm text-slate-600">
                {t("people.wizard.freeSlots", { count: billing.freeSeats })}
              </p>
            )}
            <div className="flex gap-2">
              <Button loading={busy} onClick={() => void startCount()}>
                {t("people.wizard.next")}
              </Button>
              <Button variant="ghost" onClick={() => setStep({ name: "idle" })}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        {step.name === "pay" && step.quote && (
          <div className="space-y-4 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-800">{toPayText(step.quote)}</p>
            {!subscribed && (
              <p className="text-xs text-slate-500">{t("billing.price", { amount: money(billing.perUser) })}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {stubEnabled ? (
                <Button loading={busy} onClick={() => void pay(step.quote!, step.count)}>
                  {t("people.wizard.pay")}
                </Button>
              ) : (
                <p className="text-sm text-slate-500">{t("billing.paymentSoon")}</p>
              )}
              <Button variant="ghost" onClick={() => setStep({ name: "idle" })}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        {step.name === "forms" && (
          <div className="space-y-4 border-t border-slate-200 pt-4">
            {Array.from({ length: step.count }, (_, index) =>
              added.has(index) ? (
                <p key={index} className="text-sm text-emerald-700">
                  ✓ {t("people.wizard.person", { n: index + 1, total: step.count })} — {t("people.wizard.done")}
                </p>
              ) : (
                <RelativeForm
                  key={index}
                  index={index}
                  total={step.count}
                  onAdded={() => personAdded(index, step.count)}
                />
              ),
            )}
            <Button variant="ghost" onClick={() => setStep({ name: "idle" })}>
              {t("people.wizard.finish")}
            </Button>
          </div>
        )}

        {step.name === "slots" && (
          <div className="space-y-4 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-600">{t("people.slots.help")}</p>
            <SelectField
              label={t("people.slots.new")}
              value={String(newSeats)}
              options={Array.from({ length: billing.seats + 1 }, (_, i) => ({
                value: String(i),
                label: String(i),
              }))}
              onChange={(e) => {
                setNewSeats(Number(e.target.value));
                setRemove(new Set());
              }}
            />
            {surplus > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-slate-800">{t("people.slots.choose", { count: surplus })}</p>
                {people.map((person) => (
                  <CheckboxField
                    key={person.id}
                    label={`${person.firstName} ${person.lastName}`}
                    checked={remove.has(person.id)}
                    onChange={(e) => {
                      const next = new Set(remove);
                      if (e.target.checked) next.add(person.id);
                      else next.delete(person.id);
                      setRemove(next);
                    }}
                  />
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                loading={busy}
                disabled={remove.size !== surplus || newSeats === billing.seats}
                onClick={() => void reduce()}
              >
                {t("people.slots.confirm")}
              </Button>
              <Button variant="ghost" onClick={() => setStep({ name: "idle" })}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        {!subscribed && step.name === "idle" && (
          <p className="text-xs text-slate-500">
            {t("people.needSubscription")}{" "}
            <Link href={`${ROUTES.settings}#subscription`} className="underline">
              {t("people.goSubscription")}
            </Link>
          </p>
        )}
      </div>
    </Card>
  );
}

