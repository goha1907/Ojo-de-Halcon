/** Plain formatting helpers for the admin pages (English locale, UTC for stable dates). */
export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso)) + " UTC";
}

export function dateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));
}

export function money(amount: number, currency = "ARS"): string {
  return `${new Intl.NumberFormat("en-US").format(amount)} ${currency}`;
}

/** Page number from a query parameter (1 when missing or invalid). */
export function pageParam(value: string | undefined): number {
  const page = Math.trunc(Number(value));
  return Number.isFinite(page) && page > 0 ? page : 1;
}
