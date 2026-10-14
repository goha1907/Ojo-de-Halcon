"use client";

import type { PersonDto } from "@ojo/core";
import { API_ROUTES, APP_CONFIG, SETTINGS_SECTIONS, findJurisdiction, settingsHref } from "@ojo/shared";
import { Alert, Button, Card, CheckboxField, SelectField } from "@ojo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { ProfileFields, useProfileFields } from "@/components/profile/profile-fields";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { issuesToFieldErrors } from "@/lib/form-errors";

const EMPTY = { firstName: null, lastName: null, birthDate: null, pjnJurisdiction: null };

interface Props {
  people: PersonDto[];
  /** A subscription period is running (relatives need one). */
  subscribed: boolean;
}

type Step =
  | { name: "idle" }
  | { name: "count" }
  | { name: "forms"; count: number; done: number };

/** Edits a relative's data (birth date and court are optional and can be filled in later). */
function EditPersonForm({ person, onDone }: { person: PersonDto; onDone: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const form = useProfileFields(
    {
      firstName: person.firstName,
      lastName: person.lastName,
      birthDate: person.birthDate,
      pjnJurisdiction: person.pjnJurisdiction,
    },
    { relative: true },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const payload = form.validate();
    if (!payload) return;
    setBusy(true);
    try {
      await apiRequest(`${API_ROUTES.people}/${person.id}`, { method: "PUT", body: payload });
      router.refresh();
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === "VALIDATION") form.setErrors(issuesToFieldErrors(e.issues, t));
      else setError(describeApiError(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-3 space-y-4 border-t border-slate-200 pt-3">
      {error && <Alert tone="error">{error}</Alert>}
      <ProfileFields state={form} />
      <div className="flex gap-2">
        <Button type="submit" loading={busy}>
          {t("people.editSave")}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

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

/** Relatives the owner tracks; their cases are paid like any other case. */
export function PeopleCard({ people, subscribed }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "idle" });
  const [count, setCount] = useState(1);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const maxAdd = Math.max(0, APP_CONFIG.limits.maxPeople - people.length);
  const countOptions = useMemo(
    () => Array.from({ length: maxAdd }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
    [maxAdd],
  );

  function fail(e: unknown) {
    if (e instanceof ApiError && e.code === "LIMIT_REACHED") {
      setError(t("people.limit", { max: APP_CONFIG.limits.maxPeople }));
    } else setError(describeApiError(e, t));
  }

  function startCount() {
    setError("");
    setAdded(new Set());
    setStep({ name: "forms", count, done: 0 });
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

  return (
    <Card id={SETTINGS_SECTIONS.people} title={t("people.title")} description={t("people.help", { max: APP_CONFIG.limits.maxPeople })}>
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
                {[person.birthDate, person.pjnJurisdiction && findJurisdiction(person.pjnJurisdiction)?.code]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <Button variant="ghost" className="ml-2" onClick={() => setEditing(person.id)}>
                {t("people.edit")}
              </Button>
              <CheckboxField
                label={t("people.notify")}
                checked={person.notifyTelegram}
                onChange={(e) => void toggleNotify(person.id, e.target.checked)}
              />
              {editing === person.id && <EditPersonForm person={person} onDone={() => setEditing(null)} />}
            </li>
          ))}
        </ul>

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
            <div className="flex gap-2">
              <Button onClick={startCount}>
                {t("people.wizard.next")}
              </Button>
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

        {!subscribed && step.name === "idle" && (
          <p className="text-xs text-slate-500">
            {t("people.needSubscription")}{" "}
            <Link href={settingsHref("subscription")} className="underline">
              {t("people.goSubscription")}
            </Link>
          </p>
        )}
      </div>
    </Card>
  );
}

