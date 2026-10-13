/** Tracker sections of the product = services the user can follow. */
export const TRACKER_SECTIONS = [
  "dni_approval",
  "dni_production",
  "dni_post",
  "citizenship_dnm",
  "citizenship_court",
] as const;
export type TrackerSection = (typeof TRACKER_SECTIONS)[number];

/** Notifications are switched per service; all are on for a new account. */
export const SERVICE_DEFAULT_ENABLED = true;

export function isTrackerSection(value: string): value is TrackerSection {
  return (TRACKER_SECTIONS as readonly string[]).includes(value);
}

/** Effective on/off map: stored overrides on top of the defaults. */
export function resolveServicePreferences(
  overrides: Partial<Record<string, boolean>>,
): Record<TrackerSection, boolean> {
  const result = {} as Record<TrackerSection, boolean>;
  for (const section of TRACKER_SECTIONS) {
    result[section] = overrides[section] ?? SERVICE_DEFAULT_ENABLED;
  }
  return result;
}
