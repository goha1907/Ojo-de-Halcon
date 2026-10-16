"use client";

import { useEffect, useRef, useState } from "react";
import { TONE_STYLES, type StatusTone } from "@/lib/status-tones";

/**
 * What the colour of a tracking's edge means, in one line. The long explanation of a status
 * opens on the (i) next to it. Labels come from the caller.
 */
export function StatusLegend({
  title,
  infoLabel,
  items,
}: {
  title: string;
  /** Accessible name of the (i) buttons. */
  infoLabel: string;
  items: { tone: StatusTone; label: string; hint: string }[];
}) {
  const [open, setOpen] = useState<StatusTone | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // a click outside or Escape closes the explanation
  useEffect(() => {
    if (open === null) return;
    function onPointer(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className="relative flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs text-fg-muted"
    >
      <span className="font-semibold uppercase tracking-wide text-fg-muted">{title}</span>
      {items.map((item) => (
        <span key={item.tone} className="relative inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${TONE_STYLES[item.tone].dot}`} />
          <span className="font-medium text-fg">{item.label}</span>
          <button
            type="button"
            aria-label={`${infoLabel}: ${item.label}`}
            aria-expanded={open === item.tone}
            onClick={() => setOpen(open === item.tone ? null : item.tone)}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-line text-[10px] font-semibold leading-none text-fg-muted hover:border-fg-subtle hover:text-fg"
          >
            i
          </button>
          {open === item.tone && (
            <span
              role="note"
              className="absolute left-0 top-full z-20 mt-2 w-64 rounded-lg border border-line bg-surface p-3 text-xs leading-5 text-fg shadow-lg"
            >
              <b className="mb-0.5 block text-fg">{item.label}</b>
              {item.hint}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
