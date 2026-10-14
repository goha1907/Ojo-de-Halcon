"use client";

import { APP_CONFIG } from "@ojo/shared";
import { Button, TextField } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";

/** Inline rename of a tracked case (a personal note shown as the card title). */
export function LabelEditor({ id, current }: { id: string; current: string | null }) {
  const t = useT();
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const changed = value.trim() !== (current ?? "");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiRequest(`/api/trackers/${id}/label`, { method: "PUT", body: { label: value } });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-1.5">
      {/* the hint sits under the row so the button lines up with the input itself */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            label={t("track.label.title")}
            maxLength={APP_CONFIG.limits.labelMaxLength}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" loading={busy} disabled={!changed}>
          {t("track.label.save")}
        </Button>
      </div>
      <p className="text-xs text-slate-500">{t("track.field.labelHint")}</p>
    </form>
  );
}
