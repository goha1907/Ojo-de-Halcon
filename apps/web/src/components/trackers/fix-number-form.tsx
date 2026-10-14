"use client";

import {
  composeIsoDate,
  correoReference,
  parseCorreoReference,
  splitIsoDate,
  tramiteNumberSchema,
  type TrackerKindValue,
} from "@ojo/shared";
import { Alert, Button, TextField } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { BirthDateField } from "@/components/profile/birth-date-field";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { CorreoFields, defaultProducto, type CorreoValue } from "./correo-fields";

/**
 * Replaces the trámite number of a slot: a typo that never returned data, a
 * re-issued number, or a regular replacement once the 30-day cooldown is over.
 */
export function FixNumberForm({
  id,
  current,
  kind,
  mode = "typo",
  bare = false,
  birthDate,
}: {
  id: string;
  current: string;
  /** Correo slots are corrected with the fields of their own form. */
  kind?: TrackerKindValue;
  mode?: "typo" | "replace";
  /** No frame, title or hint: the surrounding block explains it. */
  bare?: boolean;
  /** Migraciones cases are checked with the holder's birth date: ISO (or "" = unknown) shows its field. */
  birthDate?: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [number, setNumber] = useState(current);
  const isCorreo = kind === "CORREO";
  const [correo, setCorreo] = useState<CorreoValue>(() => {
    const parsed = parseCorreoReference(current);
    const form = parsed?.form ?? "ondng";
    return {
      form,
      producto: parsed?.producto ?? defaultProducto(form),
      number: mode === "replace" ? "" : (parsed?.id ?? ""),
    };
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [birth, setBirth] = useState(splitIsoDate(birthDate ?? null));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    let value: string;
    if (isCorreo) {
      const checked = correoReference({ form: correo.form, producto: correo.producto, number: correo.number });
      if (!checked.ok) {
        setFieldErrors({ [checked.issue.field]: t(checked.issue.message) });
        return;
      }
      value = checked.reference;
    } else {
      const parsed = tramiteNumberSchema.safeParse(number);
      if (!parsed.success) {
        setError(t("validation.tramiteInvalid"));
        return;
      }
      value = parsed.data;
    }
    setBusy(true);
    try {
      const date = birthDate === undefined ? null : composeIsoDate(birth);
      await apiRequest(`/api/trackers/${id}`, {
        method: "PATCH",
        body: { number: value, ...(date ? { birthDate: date } : {}) },
      });
      router.refresh();
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === "ALREADY_EXISTS" ? t("track.error.exists") : describeApiError(e, t),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={bare ? "space-y-3" : "space-y-3 rounded-lg border border-slate-200 p-3"}
    >
      {!bare && (
        <>
          <h3 className="text-sm font-semibold text-slate-900">
            {mode === "replace" ? t("track.replace.title") : t("track.fix.title")}
          </h3>
          <p className="text-xs text-slate-500">
            {mode === "replace" ? t("track.replace.help") : t("track.fix.help")}
          </p>
        </>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      <div className={bare ? "flex items-end gap-3" : "space-y-3"}>
        <div className={bare ? "min-w-0 flex-1" : undefined}>
          {isCorreo ? (
            <CorreoFields value={correo} errors={fieldErrors} onChange={setCorreo} lockForm />
          ) : (
            <TextField
              label={t("track.field.tramite")}
              inputMode="numeric"
              value={mode === "replace" && number === current ? "" : number}
              onChange={(e) => setNumber(e.target.value)}
            />
          )}
        </div>
        {birthDate === undefined && (
          <Button type="submit" loading={busy}>
            {mode === "replace" ? t("track.replace.save") : t("track.fix.save")}
          </Button>
        )}
      </div>
      {birthDate !== undefined && (
        <>
          <BirthDateField label={t("track.dnm.birthDate")} value={birth} onChange={setBirth} />
          <Button type="submit" loading={busy}>
            {mode === "replace" ? t("track.replace.save") : t("track.fix.save")}
          </Button>
        </>
      )}
    </form>
  );
}
