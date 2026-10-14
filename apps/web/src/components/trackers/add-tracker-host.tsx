"use client";

import type { TrackerKindValue } from "@ojo/shared";
import { useEffect, useState } from "react";
import { ADD_TRACKER_EVENT, AddTrackerModal } from "./add-tracker-modal";

interface OpenRequest {
  kind?: TrackerKindValue;
  /** The kind is fixed by the section the user is on (no dropdown). */
  fixed?: boolean;
}

/** The one modal of a page; every "+ Tracking" button opens it through a window event. */
export function AddTrackerHost({
  defaultJurisdiction,
  lock,
  usage,
  defaultBirthDate,
}: {
  defaultJurisdiction: string | null;
  lock: "trial" | "expired" | null;
  usage: { used: number; limit: number } | null;
  defaultBirthDate: string | null;
}) {
  const [open, setOpen] = useState(false);
  // Bumped on every open so the form starts fresh.
  const [session, setSession] = useState(0);
  const [request, setRequest] = useState<OpenRequest>({});

  useEffect(() => {
    function onRequest(event: Event) {
      setRequest((event as CustomEvent<OpenRequest>).detail ?? {});
      setSession((value) => value + 1);
      setOpen(true);
    }
    window.addEventListener(ADD_TRACKER_EVENT, onRequest);
    return () => window.removeEventListener(ADD_TRACKER_EVENT, onRequest);
  }, []);

  return (
    <AddTrackerModal
      key={session}
      open={open}
      onClose={() => setOpen(false)}
      defaultJurisdiction={defaultJurisdiction}
      lock={lock}
      usage={usage}
      defaultBirthDate={defaultBirthDate}
      {...(request.kind ? { initialKind: request.kind } : {})}
      fixedKind={Boolean(request.fixed && request.kind)}
    />
  );
}
