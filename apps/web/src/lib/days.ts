const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Whole days between a source date ("2026-10-11…") and `now`; null when the text is no date. */
export function daysSince(text: string | undefined, now: Date): number | null {
  const match = text ? ISO_DATE.exec(text) : null;
  if (!match) return null;
  const from = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((today - from) / DAY_MS));
}
