/** Tracker sections of the product = services the user can follow. */
export const TRACKER_SECTIONS = [
  "dni_approval",
  "dni_production",
  "dni_post",
  "post_ocasa",
  "citizenship_dnm",
  "citizenship_court",
] as const;
export type TrackerSection = (typeof TRACKER_SECTIONS)[number];

/** Sections switched off for everybody, staff included (see `DISABLED_KINDS`). */
export const DISABLED_SECTIONS: readonly TrackerSection[] = ["post_ocasa"];

/** Sections not open to everyone yet (see `EARLY_ACCESS_KINDS`). */
export const EARLY_ACCESS_SECTIONS: readonly TrackerSection[] = ["post_ocasa"];
