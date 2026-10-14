"use client";

import { Button } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";

/** Frees the slot of a court case (allowed once per cooldown); a new case is then added as usual. */
export function ReleaseCaseButton({ id, mode = "replace" }: { id: string; mode?: "replace" | "delete" }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      loading={busy}
      onClick={async () => {
        if (!window.confirm(mode === "delete" ? t("track.delete.confirm") : t("track.replace.confirmCase"))) return;
        setBusy(true);
        try {
          await apiRequest(`/api/trackers/${id}`, { method: "DELETE" });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {mode === "delete" ? t("track.delete.button") : t("track.replace.case")}
    </Button>
  );
}
