"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/api-client";

const BUTTON = "rounded-field border border-line bg-surface px-3 py-1.5 text-sm hover:bg-line/40 disabled:opacity-50";

/** Test tools while payments are simulated: one more period, or start over (also clears the test payment log). */
export function SubscriptionTools({ userId, subscribed }: { userId: string; subscribed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function run(action: "renew" | "reset") {
    if (action === "reset" && !window.confirm("End the subscription now and clear the test payment log of this account?")) return;
    setBusy(action);
    setError("");
    try {
      await apiRequest(`/api/admin/users/${userId}/subscription`, { method: "POST", body: { action } });
      router.refresh();
    } catch {
      setError("Not done (nothing to renew, or the account changed). Reload the page.");
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={BUTTON} disabled={busy !== "" || !subscribed} onClick={() => void run("renew")}>Simulate a renewal</button>
      <button className={BUTTON} disabled={busy !== ""} onClick={() => void run("reset")}>Reset the subscription and clear the test payments</button>
      {error && <span className="text-xs text-error-fg">{error}</span>}
    </div>
  );
}
