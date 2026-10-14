"use client";

import type { PersonDto } from "@ojo/core";
import type { TrackerKindValue } from "@ojo/shared";
import { Button } from "@ojo/ui";
import { useEffect, useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { ADD_TRACKER_EVENT, AddTrackerModal } from "./add-tracker-modal";

/** Header button available on every signed-in page; also opens on ADD_TRACKER_EVENT. */
export function AddTrackerButton({
  defaultJurisdiction,
  people,
  lock,
}: {
  defaultJurisdiction: string | null;
  people: PersonDto[];
  lock: "trial" | "expired" | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // Bumped on every open so the form starts fresh.
  const [session, setSession] = useState(0);
  const [kind, setKind] = useState<TrackerKindValue | undefined>(undefined);

  useEffect(() => {
    function onRequest(event: Event) {
      const detail = (event as CustomEvent<{ kind?: TrackerKindValue }>).detail;
      setKind(detail?.kind);
      setSession((value) => value + 1);
      setOpen(true);
    }
    window.addEventListener(ADD_TRACKER_EVENT, onRequest);
    return () => window.removeEventListener(ADD_TRACKER_EVENT, onRequest);
  }, []);

  return (
    <>
      <Button
        onClick={() => {
          setKind(undefined);
          setSession((value) => value + 1);
          setOpen(true);
        }}
      >
        {t("track.add")}
      </Button>
      <AddTrackerModal
        key={session}
        open={open}
        onClose={() => setOpen(false)}
        defaultJurisdiction={defaultJurisdiction}
        people={people}
        lock={lock}
        {...(kind ? { initialKind: kind } : {})}
      />
    </>
  );
}
