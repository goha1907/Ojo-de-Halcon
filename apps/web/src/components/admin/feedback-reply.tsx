"use client";

import { Alert } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "@/lib/api-client";

/** Reply box of an inbox message. The answer is only recorded: the support mailbox is not connected yet. */
export function FeedbackReply({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/admin/feedback/${id}/reply`, { method: "POST", body: { text } });
      setText("");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof ApiError && error.code === "BAD_REQUEST"
          ? "Not sent: the answer is empty or longer than 5000 characters."
          : "Not sent: the server failed. Try again; if it repeats, restart the dev server (the database changed) and check its log.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <Alert tone="info">Test mode: the answer to {email} is saved and the message moves to “Answered”, but no e-mail is sent yet.</Alert>
      {error && <Alert tone="error">{error}</Alert>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        maxLength={5000}
        aria-label="Answer"
        className="w-full rounded-field border border-line bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-2 focus-visible:outline-ring"
      />
      <button disabled={busy || !text.trim()} className="rounded-field bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover disabled:opacity-50">
        {busy ? "Sending…" : "Send answer"}
      </button>
    </form>
  );
}
