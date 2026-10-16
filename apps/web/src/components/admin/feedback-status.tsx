"use client";

import { Select } from "@ojo/ui";
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
    <Select
      size="sm"
      className="w-32"
      aria-label="Message status"
      value={value}
      disabled={busy}
      onChange={(next) => void change(next)}
      options={STATUSES.map((item) => ({ value: item, label: item.charAt(0) + item.slice(1).toLowerCase() }))}
    />
  );
}
