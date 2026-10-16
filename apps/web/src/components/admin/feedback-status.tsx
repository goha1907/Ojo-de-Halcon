"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/api-client";

const STATUSES = ["NEW", "READ", "ANSWERED", "SPAM"] as const;

export function FeedbackStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);
  async function change(next: string) {
    setBusy(true);
    try {
      await apiRequest(`/api/admin/feedback/${id}`, { method: "PUT", body: { status: next } });
      setValue(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <select
      value={value}
      disabled={busy}
      onChange={(e) => void change(e.target.value)}
      className="rounded-field border border-line bg-surface px-2 py-1 text-sm text-fg focus-visible:outline-2 focus-visible:outline-ring"
      aria-label="Message status"
    >
      {STATUSES.map((item) => (
        <option key={item} value={item}>
          {item.charAt(0) + item.slice(1).toLowerCase()}
        </option>
      ))}
    </select>
  );
}
