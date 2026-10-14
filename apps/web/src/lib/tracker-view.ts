import type { TrackerDto } from "@ojo/core";
import { correoDisplay, parsePjnReference } from "@ojo/shared";

/** The number shown to people: the court file number for court cases, else the trámite number. */
export function displayNumber(tracker: Pick<TrackerDto, "kind" | "reference" | "header">): string {
  if (tracker.kind === "CORREO") return correoDisplay(tracker.reference);
  if (tracker.kind !== "PJN") return tracker.reference;
  if (tracker.header.expediente) return tracker.header.expediente;
  const parsed = parsePjnReference(tracker.reference);
  return parsed ? `${parsed.number}/${parsed.year}` : tracker.reference;
}

/** Where the case stands now, in the source's own words (empty until the first read). */
export function currentStatus(tracker: Pick<TrackerDto, "kind" | "header" | "steps">): string {
  const { header, steps } = tracker;
  const latest = steps[steps.length - 1]?.title ?? "";
  switch (tracker.kind) {
    case "PJN":
      return header.sit_actual ?? latest;
    case "CORREO":
      return latest;
    default:
      return header.status ?? latest;
  }
}

function toTime(text: string | undefined): number {
  if (!text) return Number.NaN;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  return dmy ? Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])) : Number.NaN;
}

/** Epoch ms of the latest change at the source (status date or last stage), else of the last check. */
export function lastChange(tracker: Pick<TrackerDto, "header" | "steps" | "lastCheckedAt" | "addedAt">): number {
  for (const text of [tracker.header.statusDate, tracker.steps[tracker.steps.length - 1]?.date]) {
    const time = toTime(text);
    if (!Number.isNaN(time)) return time;
  }
  return new Date(tracker.lastCheckedAt ?? tracker.addedAt).getTime();
}
