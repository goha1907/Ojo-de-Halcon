/** Tracker tuning. Not exposed to users: the refresh cadence is a product decision. */
export const TRACKER_CONFIG = {
  /** How often every active tracker is re-checked. */
  checkIntervalHours: 3,
  /** Retry delay after a failed check. */
  retryAfterMinutes: 30,
  /** Maximum number of trackers checked per worker tick. */
  batchSize: 5,
  /** How often the worker looks for due trackers. */
  tickIntervalSeconds: 60,
  /** Lengths accepted for a DNI trámite number. */
  tramiteNumber: { minDigits: 6, maxDigits: 12 },
  /** Case number / year limits for PJN. */
  pjn: { minYear: 2000, maxNumberDigits: 7 },
} as const;
