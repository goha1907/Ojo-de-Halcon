import type { TrackerStep } from "./trackers";

/** OCASA writes its tracking number as the trámite number padded with zeros to this length. */
export const OCASA_NUMBER_LENGTH = 12;

const MONTHS: Record<string, number> = {
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12,
};

/** "16/OCT - 17:18 hs." */
const MOMENT = /^(\d{1,2})\/([A-Za-zÁ-ú]{3})\.?\s*-\s*(\d{1,2}):(\d{2})\s*hs?\.?$/;
/** Lines after the last step that are not part of it. */
const END_OF_STEPS = /^(ver\s+(menos|más|mas)|referencias de ubicaci[oó]n|origen|destino|mi direcci[oó]n)\b/i;

export interface OcasaPage {
  /** The tracking number shown on the page (digits), when it was found. */
  number: string | null;
  /** Oldest first, like every other source. */
  steps: TrackerStep[];
}

function isoMoment(day: number, month: number, hour: number, minute: number, now: Date): string {
  // the page shows no year: take the latest year in which the moment is not in the future
  let year = now.getUTCFullYear();
  const candidate = (y: number) => Date.UTC(y, month - 1, day, hour, minute);
  if (candidate(year) > now.getTime() + 24 * 3_600_000) year -= 1;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`;
}

/**
 * Reads the text of OCASA's tracking page, as copied by a person (select all, copy). Only the stages and the
 * tracking number are taken; everything else on the page (the recipient's name and address, the map) is
 * dropped and never stored.
 */
export function parseOcasaText(text: string, now: Date = new Date()): OcasaPage {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let number: string | null = null;
  const label = lines.findIndex((line) => /^tracking number$/i.test(line));
  if (label > 0 && /^\d{6,}$/.test(lines[label - 1]!)) number = lines[label - 1]!;

  const moments = lines.flatMap((line, index) => (MOMENT.test(line) ? [index] : []));
  const steps: TrackerStep[] = moments.flatMap((at, position) => {
    const match = MOMENT.exec(lines[at]!)!;
    const month = MONTHS[match[2]!.slice(0, 3).toUpperCase()];
    const title = at > 0 ? lines[at - 1]! : "";
    if (!month || !title) return [];
    // the description runs up to the title of the next stage (the line right before its date) or the end of the list
    const next = moments[position + 1];
    const limit = next !== undefined ? next - 1 : lines.length;
    const detail: string[] = [];
    for (let i = at + 1; i < limit; i += 1) {
      if (END_OF_STEPS.test(lines[i]!)) break;
      detail.push(lines[i]!);
    }
    return [
      {
        date: isoMoment(Number(match[1]), month, Number(match[3]), Number(match[4]), now),
        title,
        detail: detail.join(" "),
      },
    ];
  });
  // OCASA lists the newest stage first
  return { number, steps: steps.reverse() };
}
