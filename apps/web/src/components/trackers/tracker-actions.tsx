"use client";

import { Button } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";

interface Props {
  id: string;
  status: "PENDING_CONFIRMATION" | "ACTIVE" | "FINISHED";
  /** The tracker has a twin that is removed together with it. */
  linked: boolean;
}

export function TrackerActions({ id, status, linked }: Props) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(name: string, action: () => Promise<unknown>) {
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
      {status === "PENDING_CONFIRMATION" && (
        <Button
          loading={busy === "confirm"}
          onClick={() =>
            run("confirm", () => apiRequest("/api/trackers/pjn/confirm", { method: "POST", body: { id } }))
          }
        >
          {t("pjn.find.confirm")}
        </Button>
      )}
      {status === "ACTIVE" && (
        <Button
          variant="secondary"
          loading={busy === "finish"}
          onClick={() => run("finish", () => apiRequest(`/api/trackers/${id}`, { method: "PATCH", body: { action: "finish" } }))}
        >
          {t("track.finish")}
        </Button>
      )}
      <Button
        variant="ghost"
        loading={busy === "remove"}
        onClick={() => {
          if (linked && !window.confirm(t("track.removeLinked"))) return;
          void run("remove", () => apiRequest(`/api/trackers/${id}`, { method: "DELETE" }));
        }}
      >
        {t("track.remove")}
      </Button>
    </div>
  );
}
