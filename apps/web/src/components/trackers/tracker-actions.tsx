"use client";

import { Button } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";

/**
 * Only a case waiting for confirmation has actions. A confirmed case cannot be
 * finished or removed by the user (support only), to protect subscription limits.
 */
export function PendingCaseActions({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<"confirm" | "discard" | null>(null);

  async function run(name: "confirm" | "discard", action: () => Promise<unknown>) {
    setBusy(name);
    try {
      await action();
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        loading={busy === "confirm"}
        disabled={busy === "discard"}
        onClick={() => void run("confirm", () => apiRequest("/api/trackers/pjn/confirm", { method: "POST", body: { id } }))}
      >
        {t("pjn.find.confirm")}
      </Button>
      <Button
        variant="ghost"
        loading={busy === "discard"}
        disabled={busy === "confirm"}
        onClick={() => void run("discard", () => apiRequest(`/api/trackers/${id}`, { method: "DELETE" }))}
      >
        {t("pjn.pending.discard")}
      </Button>
    </div>
  );
}
