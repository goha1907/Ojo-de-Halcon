"use client";

import { findLink, type MessageKey } from "@ojo/shared";
import { Alert, Button, Modal, buttonClass } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { useT } from "@/components/providers/i18n-provider";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";

/**
 * OCASA is updated by hand: its page asks for a "not a robot" check, so the person opens it, passes the check
 * and pastes the page here. This block says so, and holds the "Update" dialog.
 */
export function OcasaManual({
  id,
  number,
  lastCheckedAt,
  locale,
}: {
  id: string;
  number: string;
  lastCheckedAt: string | null;
  locale: string;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);
  const site = findLink("ocasa-tracking")?.url ?? "https://tracking.ocasa.com/TrackingClient";

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{ added: number }>(`/api/trackers/${id}/refresh`, { method: "POST", body: { text } });
      setDone(result.added);
      setText("");
      router.refresh();
      setOpen(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === "MISMATCH") setError(t("track.ocasa.error.mismatch"));
      else if (e instanceof ApiError && e.code === "VALIDATION") setError(t("track.ocasa.error.noSteps"));
      else setError(describeApiError(e, t));
    } finally {
      setBusy(false);
    }
  }

  const updated = lastCheckedAt
    ? t("track.ocasa.updated", {
        date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(lastCheckedAt)),
      })
    : t("track.ocasa.never");

  return (
    <div className="space-y-3 border-b border-line px-5 py-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-fg">{t("track.ocasa.manualTitle")}</h4>
        <p className="text-sm text-fg-muted">{t("track.ocasa.manualText")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-2 text-fg">
          {t("track.ocasa.numberLabel")}: <b className="font-mono">{number}</b>
          <CopyButton text={number} />
        </span>
        <span className="text-fg-muted">{updated}</span>
        {done !== null && <span className="text-success-fg">{t("track.ocasa.done", { count: done })}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { setError(""); setOpen(true); }}>{t("track.ocasa.refresh")}</Button>
        <a href={site} target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary" })}>
          {t("track.ocasa.open")}
        </a>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={t("track.ocasa.refresh")} closeLabel={t("common.cancel")}>
        <div className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-fg">
            {(["step1", "step2", "step3"] as const).map((key) => (
              <li key={key}>{t(`track.ocasa.${key}` as MessageKey)}</li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <a href={site} target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary", size: "sm" })}>
              {t("track.ocasa.open")}
            </a>
            <span className="inline-flex items-center gap-2">
              <b className="font-mono">{number}</b>
              <CopyButton text={number} />
            </span>
          </div>
          <label className="block space-y-1.5 text-sm font-medium text-fg">
            {t("track.ocasa.paste")}
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={8}
              className="block w-full rounded-field border border-line bg-surface px-3 py-2 text-sm font-normal text-fg focus-visible:outline-2 focus-visible:outline-ring"
            />
          </label>
          <p className="text-xs text-fg-muted">{t("track.ocasa.privacy")}</p>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={busy} disabled={!text.trim()} onClick={() => void submit()}>
              {t("track.ocasa.submit")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
