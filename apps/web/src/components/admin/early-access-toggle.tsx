"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/api-client";

/** Early access: lets this account use services that are not open to everyone yet (OCASA for now). */
export function EarlyAccessToggle({ userId, enabled, staff }: { userId: string; enabled: boolean; staff: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function change(next: boolean) {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/admin/users/${userId}/early-access`, { method: "PUT", body: { enabled: next } });
      router.refresh();
    } catch {
      setError("Could not change it. Reload the page and try again.");
    } finally {
      setBusy(false);
    }
  }
  if (staff) return <span className="text-sm">always (staff)</span>;
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <label className="inline-flex items-center gap-1.5">
        <input type="checkbox" checked={enabled} disabled={busy} onChange={(e) => void change(e.target.checked)} />
        {enabled ? "on" : "off"}
      </label>
      {error && <span className="text-xs text-error-fg">{error}</span>}
    </span>
  );
}
