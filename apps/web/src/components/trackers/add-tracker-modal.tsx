"use client";

import type { PersonDto } from "@ojo/core";
import {
  PJN_DEFAULT_JURISDICTION,
  PJN_JURISDICTIONS,
  ROUTES,
  TRACKER_KINDS,
  TRACKER_KIND_SECTION,
  addTrackerSchema,
  sectionHref,
  type MessageKey,
  type TrackerKindValue,
} from "@ojo/shared";
import { Alert, Button, Modal, SelectField, TextField } from "@ojo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { issuesToFieldErrors } from "@/lib/form-errors";

/** Window event other components dispatch to open the modal (optionally for one kind). */
export const ADD_TRACKER_EVENT = "ojo:add-tracker";

interface Props {
  open: boolean;
  /** Kind preselected; the parent remounts the modal (key) on every open. */
  initialKind?: TrackerKindValue;
  onClose: () => void;
  /** Court chosen in the profile, preselected for court cases. */
  defaultJurisdiction: string | null;
  /** Relatives the case can be added for (the owner is always the first option). */
  people: PersonDto[];
  /** Set when the plan does not allow another case; the form is replaced by an offer. */
  lock: "trial" | "expired" | null;
}

const ERROR_KEYS: Record<string, MessageKey> = {
  ALREADY_EXISTS: "track.error.exists",
  SECTION_BUSY: "track.error.sectionBusy",
  SUBSCRIPTION_REQUIRED: "track.error.subscription",
  PERSON_NOT_FOUND: "track.error.person",
  NOT_FOUND: "track.error.notFound",
  SOURCE_DOWN: "track.error.sourceDown",
};

/** One window for adding any tracker (the "+ Tracking" button lives in the header). */
export function AddTrackerModal({ open, onClose, defaultJurisdiction, initialKind, people, lock }: Props) {
  const t = useT();
  const router = useRouter();
  const [kind, setKind] = useState<TrackerKindValue>(initialKind ?? "RENAPER");
  const [personId, setPersonId] = useState("");
  const [number, setNumber] = useState("");
  const [year, setYear] = useState("");
  const [jurisdiction, setJurisdiction] = useState(defaultJurisdiction ?? PJN_DEFAULT_JURISDICTION);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const kindOptions = useMemo(
    () => TRACKER_KINDS.map((value) => ({ value, label: t(`track.kind.${value}` as MessageKey) })),
    [t],
  );
  const courtOptions = useMemo(
    () => PJN_JURISDICTIONS.map((item) => ({ value: item.value, label: `${item.code} — ${item.name}` })),
    [],
  );
  const personOptions = useMemo(
    () => [
      { value: "", label: t("track.person.me") },
      ...people.map((person) => ({ value: person.id, label: `${person.firstName} ${person.lastName}` })),
    ],
    [people, t],
  );
  const isCourt = kind === "PJN";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const target = personId ? { personId } : {};
    const payload = isCourt ? { kind, jurisdiction, number, year, ...target } : { kind, number, ...target };
    const parsed = addTrackerSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues, t));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await apiRequest("/api/trackers", { method: "POST", body: payload });
      const target = sectionHref(TRACKER_KIND_SECTION[kind]);
      onClose();
      setNumber("");
      setYear("");
      if (target) router.push(target);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION") {
        setErrors(issuesToFieldErrors(error.issues, t));
      } else if (error instanceof ApiError && ERROR_KEYS[error.code]) {
        setFormError(t(ERROR_KEYS[error.code]!));
      } else {
        setFormError(describeApiError(error, t));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("track.modal.title")} closeLabel={t("common.cancel")}>
      {lock ? (
        <div className="space-y-4">
          <Alert tone="info">{lock === "expired" ? t("track.limit.expired") : t("track.limit.text")}</Alert>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Link
              href={`${ROUTES.settings}#subscription`}
              onClick={onClose}
              className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              {t("track.limit.go")}
            </Link>
          </div>
        </div>
      ) : (
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        {people.length > 0 && (
          <SelectField
            label={t("track.field.person")}
            value={personId}
            options={personOptions}
            onChange={(e) => {
              const next = e.target.value;
              setPersonId(next);
              // a relative's own court is preselected
              const court = people.find((person) => person.id === next)?.pjnJurisdiction;
              setJurisdiction(next ? (court ?? PJN_DEFAULT_JURISDICTION) : (defaultJurisdiction ?? PJN_DEFAULT_JURISDICTION));
            }}
          />
        )}
        <SelectField
          label={t("track.kind")}
          value={kind}
          options={kindOptions}
          onChange={(e) => {
            setKind(e.target.value as TrackerKindValue);
            setErrors({});
          }}
        />
        {isCourt && (
          <SelectField
            label={t("field.court")}
            value={jurisdiction}
            options={courtOptions}
            error={errors.jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
          />
        )}
        <TextField
          label={isCourt ? t("track.field.caseNumber") : t("track.field.tramite")}
          inputMode="numeric"
          value={number}
          error={errors.number}
          onChange={(e) => setNumber(e.target.value)}
        />
        {isCourt && (
          <TextField
            label={t("track.field.caseYear")}
            inputMode="numeric"
            maxLength={4}
            value={year}
            error={errors.year}
            onChange={(e) => setYear(e.target.value)}
          />
        )}
        {isCourt && <Alert tone="info">{t("track.pjn.hint")}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={loading}>
            {t("track.submit")}
          </Button>
        </div>
      </form>
      )}
    </Modal>
  );
}
