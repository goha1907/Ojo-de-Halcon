import type { PrismaClient } from "@ojo/db";
import type { Mailer } from "./mailer";
import type { Scraper } from "./trackers/scraper";

export interface CoreConfig {
  /** Pepper for hashing one-time credentials (SESSION_SECRET). */
  secret: string;
  /** Public base URL, used to build links in e-mails. */
  appUrl: string;
  sessionTtlDays: number;
  telegramLinkCodeTtlMinutes: number;
  emailVerificationRequired: boolean;
  verifyEmailTtlHours: number;
  resetPasswordTtlMinutes: number;
  linkCodeBytes: number;
  sessionTokenBytes: number;
  emailTokenBytes: number;
  /** Relatives (people, slots) are switched on. */
  relativesEnabled: boolean;
}

export interface CoreDeps {
  prisma: PrismaClient;
  config: CoreConfig;
  mailer: Mailer;
  scraper: Scraper;
  /** Injectable clock for tests. */
  now?: () => Date;
}

/** User as exposed to the application (no secrets, JSON-safe). */
export interface UserDto {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  /** ISO date `YYYY-MM-DD` or null. */
  birthDate: string | null;
  /** PJN jurisdiction select value or null. */
  pjnJurisdiction: string | null;
  profileComplete: boolean;
  telegramLinked: boolean;
  telegramUsername: string | null;
  locale: string;
  onboardingDone: boolean;
}
