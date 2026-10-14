import type { TrackerKindValue } from "../domain/trackers";

/**
 * Statuses that end a case at each source. A finished case frees its slot and is kept as history.
 * Compared ignoring case, accents and surrounding spaces. A kind with no entry here (Migraciones
 * citizenship) has no known final status yet: see the anonymous status tally to learn them.
 */
export const FINAL_STATUSES: Record<TrackerKindValue, readonly string[]> = {
  /** Migraciones, DNI residence file. */
  DNM_DNI: ["RESUELTO"],
  /** Migraciones, citizenship procedure: not known yet. */
  DNM_CITIZENSHIP: [],
  /** RENAPER: the card is packed and goes to the post office. */
  RENAPER: ["EMBALADO"],
  /** Correo Argentino: delivered. */
  CORREO: ["ENTREGADO"],
  /** Court case: sent to the archive. */
  PJN: ["ARCHIVESE"],
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .trim();
}

/** Is `status` a final status of this kind of case? */
export function isFinalStatus(kind: TrackerKindValue, status: string | undefined | null): boolean {
  if (!status) return false;
  const wanted = normalize(status);
  return FINAL_STATUSES[kind].some((final) => final === wanted);
}
