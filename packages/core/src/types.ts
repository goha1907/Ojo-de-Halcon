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
  payments: {
    /** The test provider is available (never in production unless forced). */
    stubEnabled: boolean;
    stubProcessingSeconds: number;
    intentTtlMinutes: number;
  };
}

export interface CoreDeps {
  prisma: PrismaClient;
  config: CoreConfig;
  mailer: Mailer;
  scraper: Scraper;
  /** Injectable clock for tests. */
  now?: () => Date;
  /** Source kinds hidden from ordinary accounts (default: the list in the shared config). */
  earlyAccessKinds?: readonly string[];
  /** Source kinds switched off for everybody, staff included (default: the list in the shared config). */
  disabledKinds?: readonly string[];
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
  profileComplete: boolean;
  telegramLinked: boolean;
  telegramUsername: string | null;
  locale: string;
  onboardingDone: boolean;
  /** Staff role; USER for customers. */
  role: "USER" | "SUPPORT" | "ADMIN";
  /** Staff or an account with the early-access flag: may use services not open to everyone yet. */
  earlyAccess: boolean;
}
