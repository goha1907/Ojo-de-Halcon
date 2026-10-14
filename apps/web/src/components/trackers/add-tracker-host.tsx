"use client";

import type { PersonDto } from "@ojo/core";
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
  people,
  lock,
  usage,
}: {
  defaultJurisdiction: string | null;
  people: PersonDto[];
  lock: "trial" | "expired" | null;
  usage: { used: number; limit: number } | null;
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
      people={people}
      lock={lock}
      usage={usage}
      {...(request.kind ? { initialKind: request.kind } : {})}
      fixedKind={Boolean(request.fixed && request.kind)}
    />
  );
}
