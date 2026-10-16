"use client";

import { Select } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "@/lib/api-client";

const INPUT = "rounded-field border border-line bg-surface px-2 py-1.5 text-sm text-fg focus-visible:outline-2 focus-visible:outline-ring";
const BUTTON = "rounded-field border border-line bg-surface px-3 py-1.5 text-sm hover:bg-line/40 disabled:opacity-50";
const PRIMARY = "rounded-field bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg hover:bg-brand-hover disabled:opacity-50";

function newRequestId(): string {
  return crypto.randomUUID();
}

function message(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "ALREADY_EXISTS") return "This was already done (the form was sent twice).";
    if (error.code === "FORBIDDEN") return "You are not allowed to do this.";
    if (error.code === "NOT_FOUND") return "Not found (it may have changed already). Reload the page.";
    if (error.code === "BAD_REQUEST") return "Rejected: check the values (the end date must be in the future).";
  }
  return "Something went wrong. Try again.";
}

/** Form that hands out gift places. The request key makes a double click harmless. */
export function GiveGrantForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [cases, setCases] = useState("5");
  const [kind, setKind] = useState("GIFT");
  const [until, setUntil] = useState("");
  const [noEnd, setNoEnd] = useState(false);
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState(newRequestId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setDone("");
    const count = Number(cases);
    if (!Number.isInteger(count) || count < 1 || count > 100) return setError("Places: a whole number from 1 to 100.");
    if (!noEnd && !until) return setError("Pick an end date or tick “No end date”.");
    setBusy(true);
    try {
      await apiRequest(`/api/admin/users/${userId}/grants`, {
        method: "POST",
        body: {
          kind,
          cases: count,
          expiresAt: noEnd ? null : new Date(`${until}T23:59:59Z`).toISOString(),
          note: note.trim() || undefined,
          requestId,
        },
      });
      setDone(`Gave ${count} place${count === 1 ? "" : "s"}.`);
      setRequestId(newRequestId());
      router.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="text-xs text-fg-muted">
        Places
        <input className={`${INPUT} mt-1 block w-20`} inputMode="numeric" value={cases} onChange={(e) => setCases(e.target.value.replace(/\D/g, ""))} />
      </label>
      <label className="text-xs text-fg-muted">
        Type
        <Select
          size="sm"
          className="mt-1 w-44"
          value={kind}
          onChange={setKind}
          options={[
            { value: "GIFT", label: "Gift" },
            { value: "BONUS", label: "Bonus" },
            { value: "PROMO", label: "Promo" },
            { value: "ADMIN", label: "Partner / staff" },
          ]}
        />
      </label>
      <label className="text-xs text-fg-muted">
        Valid until (UTC, end of day)
        <input type="date" className={`${INPUT} mt-1 block`} value={until} disabled={noEnd} onChange={(e) => setUntil(e.target.value)} />
      </label>
      <label className="flex items-center gap-1.5 pb-2 text-xs text-fg-muted">
        <input type="checkbox" checked={noEnd} onChange={(e) => setNoEnd(e.target.checked)} />
        No end date
      </label>
      <label className="text-xs text-fg-muted">
        Note (optional)
        <input className={`${INPUT} mt-1 block w-48`} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button type="submit" disabled={busy} className={PRIMARY}>
        {busy ? "Saving…" : "Give places"}
      </button>
      {error && <p className="w-full text-sm text-error-fg">{error}</p>}
      {done && <p className="w-full text-sm text-success-fg">{done}</p>}
    </form>
  );
}

/** Revoke and change-the-end-date controls of one grant row. */
export function GrantRowActions({ grantId, expiresAt }: { grantId: string; expiresAt: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(expiresAt ? expiresAt.slice(0, 10) : "");
  const [error, setError] = useState("");

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className={BUTTON} onClick={() => setEditing((value) => !value)}>
          Change end date
        </button>
        <button
          type="button"
          disabled={busy}
          className={`${BUTTON} text-error-fg`}
          onClick={() => {
            if (confirm("Take these places back right now?")) void run(() => apiRequest(`/api/admin/grants/${grantId}`, { method: "DELETE" }));
          }}
        >
          Revoke
        </button>
      </div>
      {editing && (
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
          <button
            type="button"
            disabled={busy || !date}
            className={PRIMARY}
            onClick={() =>
              void run(() =>
                apiRequest(`/api/admin/grants/${grantId}`, {
                  method: "PUT",
                  body: { expiresAt: new Date(`${date}T23:59:59Z`).toISOString(), requestId: newRequestId() },
                }),
              )
            }
          >
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            className={BUTTON}
            onClick={() => void run(() => apiRequest(`/api/admin/grants/${grantId}`, { method: "PUT", body: { expiresAt: null, requestId: newRequestId() } }))}
          >
            No end date
          </button>
        </div>
      )}
      {error && <p className="text-xs text-error-fg">{error}</p>}
    </div>
  );
}
