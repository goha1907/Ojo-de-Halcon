"use client";

import {
  API_ROUTES,
  APP_CONFIG,
  PJN_DEFAULT_JURISDICTION,
  PJN_JURISDICTIONS,
  composeIsoDate,
  isDnmKind,
  splitIsoDate,
  settingsHref,
  TRACKER_KINDS,
  TRACKER_KIND_SECTION,
  addTrackerSchema,
  tramiteNumberSchema,
  sectionHref,
  type MessageKey,
  type TrackerKindValue,
} from "@ojo/shared";
import { Alert, Button, Modal, SelectField, TextField } from "@ojo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { BirthDateField } from "@/components/profile/birth-date-field";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { issuesToFieldErrors } from "@/lib/form-errors";

/** Window event other components dispatch to open the modal (optionally for one kind). */
export const ADD_TRACKER_EVENT = "ojo:add-tracker";

interface Props {
  open: boolean;
  /** Kind preselected; the parent remounts the modal (key) on every open. */
  initialKind?: TrackerKindValue;
  /** The kind comes from the current section: no kind dropdown. */
  fixedKind?: boolean;
  onClose: () => void;
  /** Court chosen in the profile, preselected for court cases. */
  defaultJurisdiction: string | null;
  /** Set when the plan does not allow another case; the form is replaced by an offer. */
  lock: "trial" | "expired" | null;
  /** Used / paid cases of a subscription (null: no subscription); when all are taken the form is replaced by an offer to buy more. */
  usage: { used: number; limit: number } | null;
  /** Profile birth date (ISO) offered for Migraciones kinds; can be changed per case. */
  defaultBirthDate: string | null;
}

const ERROR_KEYS: Record<string, MessageKey> = {
  ALREADY_EXISTS: "track.error.exists",
  NO_FREE_SLOT: "track.error.noFreeSlot",
  BIRTH_DATE_REQUIRED: "track.error.birthRequired",
  MISMATCH: "track.mismatch",
  SUBSCRIPTION_REQUIRED: "track.error.subscription",
  NOT_FOUND: "track.error.notFound",
  SOURCE_DOWN: "track.error.sourceDown",
};

/** One window for adding any tracker (the "+ Tracking" button lives in the header). */
export function AddTrackerModal({ open, onClose, defaultJurisdiction, initialKind, lock, usage, defaultBirthDate, fixedKind = false }: Props) {
  const t = useT();
  const router = useRouter();
  const [kind, setKind] = useState<TrackerKindValue>(initialKind ?? "RENAPER");
  const [birthDate, setBirthDate] = useState(splitIsoDate(defaultBirthDate));
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [found, setFound] = useState<Record<string, string> | null>(null);
  const [label, setLabel] = useState("");
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
  const isCourt = kind === "PJN";
  const slots = usage;
  // every paid case is taken: offer to buy more instead of the form
  const full = lock === null && slots !== null && slots.used >= slots.limit;

  function showError(error: unknown) {
    if (error instanceof ApiError && error.code === "VALIDATION") {
      setErrors(issuesToFieldErrors(error.issues, t));
    } else if (error instanceof ApiError && ERROR_KEYS[error.code]) {
      setFormError(t(ERROR_KEYS[error.code]!));
    } else {
      setFormError(describeApiError(error, t));
    }
  }

  function buildPayload() {
    const extra = label.trim() ? { label: label.trim() } : {};
    if (isCourt) return { kind, jurisdiction, number, year, ...extra };
    const birth = composeIsoDate(birthDate);
    return isDnmKind(kind) && birth ? { kind, number, birthDate: birth, ...extra } : { kind, number, ...extra };
  }

  /** Step one: validate; a court case is looked up so its header can be shown, a number is read back. */
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const payload = buildPayload();
    const parsed = addTrackerSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues, t));
      return;
    }
    setErrors({});
    if (!isCourt && !isDnmKind(kind)) {
      setStep("confirm");
      return;
    }
    setLoading(true);
    try {
      // the source is asked first, so the user sees what is found before agreeing
      const { label: _label, ...caseInput } = payload as Record<string, string>;
      const result = isCourt
        ? await apiRequest<{ header: Record<string, string> }>(API_ROUTES.pjnPreview, {
            method: "POST",
            body: (({ kind: _kind, ...rest }) => rest)(caseInput),
          })
        : await apiRequest<{ header: Record<string, string> }>(API_ROUTES.dnmPreview, {
            method: "POST",
            body: caseInput,
          });
      setFound(result.header);
      setStep("confirm");
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  /** Step two: the user saw what is being added and confirmed. */
  async function onConfirm() {
    setFormError("");
    setLoading(true);
    try {
      await apiRequest("/api/trackers", { method: "POST", body: buildPayload() });
      const destination = sectionHref(TRACKER_KIND_SECTION[kind]);
      onClose();
      if (destination) router.push(destination);
      router.refresh();
    } catch (error) {
      setStep("form");
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        fixedKind
          ? `${t("track.modal.title")}: ${t(`track.kind.${kind}` as MessageKey)}`
          : t("track.modal.title")
      }
      closeLabel={t("common.cancel")}
    >
      {lock ? (
        <div className="space-y-4">
          <Alert tone="info">{lock === "expired" ? t("track.limit.expired") : t("track.limit.text")}</Alert>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Link
              href={settingsHref("subscription")}
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
        {!fixedKind && (
          <SelectField
            label={t("track.kind")}
            value={kind}
            options={kindOptions}
            onChange={(e) => {
              setKind(e.target.value as TrackerKindValue);
              setErrors({});
            }}
          />
        )}
        {full && slots ? (
          <div className="space-y-4">
            <Alert tone="info">{t("track.limit.full", { used: slots.used, limit: slots.limit })}</Alert>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Link
                href={settingsHref("subscription")}
                onClick={onClose}
                className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                {t("track.limit.go")}
              </Link>
            </div>
          </div>
        ) : (
          <>
          {step === "confirm" ? (
            <div className="space-y-4">
              {label.trim() && (
                <p className="text-sm text-slate-600">{t("track.step.name", { name: label.trim() })}</p>
              )}
              {(isCourt || isDnmKind(kind)) && found ? (
                <>
                  <h3 className="text-base font-semibold text-slate-900">
                    {isCourt ? t("track.step.confirmCase") : t("track.dnm.confirmTitle")}
                  </h3>
                  <dl className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm">
                    {Object.entries(found)
                      .filter(([key, value]) => value && key !== "closed")
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt className="text-xs uppercase tracking-wide text-slate-500">
                            {isCourt
                              ? t(`track.header.${key}` as MessageKey)
                              : t(`track.dnm.${key}` as MessageKey)}
                          </dt>
                          <dd className="text-slate-900">{value}</dd>
                        </div>
                      ))}
                  </dl>
                  {found.closed ? (
                    <Alert tone="info">{t("track.dnm.closed", { state: found.state ?? "" })}</Alert>
                  ) : (
                    <Alert tone="info">
                      {isCourt ? t("track.step.confirmCaseText") : t("track.dnm.confirmText")}
                    </Alert>
                  )}
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-slate-900">{t("track.step.confirmNumber")}</h3>
                  <p className="rounded-lg border border-slate-200 p-3 text-2xl font-semibold tracking-wide text-slate-900">
                    {tramiteNumberSchema.safeParse(number).data ?? number}
                  </p>
                  <Alert tone="info">
                    {t("track.step.confirmNumberText", {
                      number: tramiteNumberSchema.safeParse(number).data ?? number,
                    })}
                  </Alert>
                </>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setStep("form")}>
                  {t("track.step.back")}
                </Button>
                <Button loading={loading} onClick={() => void onConfirm()}>
                  {isCourt
                    ? t("track.step.addCase")
                    : found?.closed
                      ? t("track.dnm.addClosed")
                      : isDnmKind(kind)
                        ? t("track.dnm.add")
                        : t("track.step.addNumber")}
                </Button>
              </div>
            </div>
          ) : (
          <>
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
        {isDnmKind(kind) && (
          <div className="space-y-1.5">
            <BirthDateField
              label={t("track.dnm.birthDate")}
              value={birthDate}
              error={errors.birthDate}
              onChange={setBirthDate}
            />
            <p className="text-xs text-slate-500">{t("track.dnm.birthHint")}</p>
          </div>
        )}
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
        <TextField
          label={t("track.field.label")}
          hint={t("track.field.labelHint")}
          maxLength={APP_CONFIG.limits.labelMaxLength}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        {isCourt && <Alert tone="info">{t("track.pjn.hint")}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={loading}>
            {isCourt ? t("track.step.find") : isDnmKind(kind) ? t("track.dnm.find") : t("track.step.next")}
          </Button>
        </div>
          </>
          )}
          </>
        )}
      </form>
      )}
    </Modal>
  );
}
