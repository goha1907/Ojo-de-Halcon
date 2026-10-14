"use client";

import type { TrackerKindValue } from "@ojo/shared";
import { Button } from "@ojo/ui";
import { useT } from "@/components/providers/i18n-provider";
import { ADD_TRACKER_EVENT } from "./add-tracker-modal";

/**
 * "+ Tracking" button. It only asks the page's single <AddTrackerHost> to open
 * the modal. Without `kind` the modal shows the kind dropdown (global button);
 * with `kind` it opens straight for that section (section buttons).
 */
export function AddTrackerButton({
  kind,
  fullWidth = false,
}: {
  kind?: TrackerKindValue;
  fullWidth?: boolean;
}) {
  const t = useT();
  return (
    <Button
      fullWidth={fullWidth}
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent(ADD_TRACKER_EVENT, { detail: kind ? { kind, fixed: true } : {} }),
        )
      }
    >
      {t("track.add")}
    </Button>
  );
}
