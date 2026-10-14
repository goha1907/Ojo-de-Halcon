"use client";

import type { PersonDto } from "@ojo/core";
import { API_ROUTES, APP_CONFIG, findJurisdiction } from "@ojo/shared";
import { Alert, Button, Card, CheckboxField } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { ProfileFields, useProfileFields } from "@/components/profile/profile-fields";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { issuesToFieldErrors } from "@/lib/form-errors";

const EMPTY = { firstName: null, lastName: null, birthDate: null, pjnJurisdiction: null };

/** Relatives whose cases the owner tracks (each counts as a user for the subscription). */
export function PeopleCard({ people }: { people: PersonDto[] }) {
  const t = useT();
  const router = useRouter();
  const form = useProfileFields(EMPTY, { relative: true });
  const [adding, setAdding] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const full = people.length >= APP_CONFIG.limits.maxPeople;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const payload = form.validate();
    if (!consent) setConsentError(t("validation.personConsent"));
    if (!payload || !consent) return;
    setConsentError("");
    setBusy(true);
    try {
      await apiRequest(API_ROUTES.people, { method: "POST", body: payload });
      setAdding(false);
      setConsent(false);
      form.setValues({ firstName: "", lastName: "", birthDate: { day: "", month: "", year: "" }, pjnJurisdiction: "" });
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === "VALIDATION") form.setErrors(issuesToFieldErrors(e.issues, t));
      else if (e instanceof ApiError && e.code === "SUBSCRIPTION_REQUIRED") setError(t("people.subscription"));
      else if (e instanceof ApiError && e.code === "LIMIT_REACHED") {
        setError(t("people.limit", { max: APP_CONFIG.limits.maxPeople }));
      } else setError(describeApiError(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t("people.removeConfirm"))) return;
    setBusy(true);
    try {
      await apiRequest(`${API_ROUTES.people}/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={t("people.title")} description={t("people.help", { max: APP_CONFIG.limits.maxPeople })}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {people.length === 0 && !adding && <p className="text-sm text-slate-500">{t("people.empty")}</p>}
        <ul className="space-y-2">
          {people.map((person) => (
            <li
              key={person.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="font-medium text-slate-900">
                  {person.firstName} {person.lastName}
                </span>
                <span className="ml-2 text-slate-500">
                  {person.birthDate}
                  {person.pjnJurisdiction && ` · ${findJurisdiction(person.pjnJurisdiction)?.code ?? ""}`}
                </span>
              </span>
              <Button variant="ghost" disabled={busy} onClick={() => void remove(person.id)}>
                {t("people.remove")}
              </Button>
            </li>
          ))}
        </ul>

        {adding ? (
          <form onSubmit={onSubmit} noValidate className="space-y-4 border-t border-slate-200 pt-4">
            <ProfileFields state={form} />
            <CheckboxField
              label={t("people.consent")}
              checked={consent}
              error={consentError}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <div className="flex gap-2">
              <Button type="submit" loading={busy}>
                {t("people.save")}
              </Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        ) : full ? (
          <Alert tone="info">{t("people.limit", { max: APP_CONFIG.limits.maxPeople })}</Alert>
        ) : (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            {t("people.add")}
          </Button>
        )}
      </div>
    </Card>
  );
}
