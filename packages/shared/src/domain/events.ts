/** Tracker sections of the product = services the user can follow. */
export const TRACKER_SECTIONS = [
  "dni_approval",
  "dni_production",
  "dni_post",
  "citizenship_dnm",
  "citizenship_court",
] as const;
export type TrackerSection = (typeof TRACKER_SECTIONS)[number];
