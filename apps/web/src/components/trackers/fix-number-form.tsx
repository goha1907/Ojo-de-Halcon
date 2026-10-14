"use client";

import { tramiteNumberSchema } from "@ojo/shared";
import { Alert, Button, TextField } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";

/**
 * Replaces the trámite number of a slot: a typo that never returned data, a
 * re-issued number, or a regular replacement once the 30-day cooldown is over.
 */
export function FixNumberForm({
  id,
  current,
  mode = "typo",
  bare = false,
}: {
  id: string;
  current: string;
  mode?: "typo" | "replace";
  /** No frame, title or hint: the surrounding block explains it. */
  bare?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [number, setNumber] = useState(current);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = tramiteNumberSchema.safeParse(number);
    if (!parsed.success) {
      setError(t("validation.tramiteInvalid"));
      return;
    }
    setBusy(true);
    try {
      await apiRequest(`/api/trackers/${id}`, { method: "PATCH", body: { number: parsed.data } });
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
      <TextField
        label={t("track.field.tramite")}
        inputMode="numeric"
        value={mode === "replace" && number === current ? "" : number}
        onChange={(e) => setNumber(e.target.value)}
      />
      <Button type="submit" loading={busy}>
        {mode === "replace" ? t("track.replace.save") : t("track.fix.save")}
      </Button>
    </form>
  );
}
