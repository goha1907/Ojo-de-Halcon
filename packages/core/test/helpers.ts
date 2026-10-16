import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { createPrismaClient } from "@ojo/db";
import {
  createCore,
  type CoreConfig,
  type MailMessage,
  type Mailer,
  type Scraper,
} from "../src/index";

loadDotenv({ path: path.resolve(import.meta.dirname, "../../../.env") });

export const prisma = createPrismaClient(process.env.TEST_DATABASE_URL!);

export const testConfig: CoreConfig = {
  secret: "test-secret-".padEnd(40, "x"),
  appUrl: "http://test.local",
  sessionTtlDays: 30,
  telegramLinkCodeTtlMinutes: 10,
  emailVerificationRequired: false,
  verifyEmailTtlHours: 48,
  resetPasswordTtlMinutes: 60,
  linkCodeBytes: 18,
  sessionTokenBytes: 32,
  emailTokenBytes: 32,
  payments: { stubEnabled: true, stubProcessingSeconds: 5, intentTtlMinutes: 15 },
};

export function makeMailbox() {
  const sent: MailMessage[] = [];
  const mailer: Mailer = { send: async (message) => void sent.push(message) };
  return { sent, mailer };
}

const unusedScraper: Scraper = {
  renaper: async () => {
    throw new Error("scraper not stubbed");
  },
  correo: async () => {
    throw new Error("scraper not stubbed");
  },
  dnm: async () => {
    throw new Error("scraper not stubbed");
  },
  pjnParty: async () => {
    throw new Error("scraper not stubbed");
  },
  pjnCase: async () => {
    throw new Error("scraper not stubbed");
  },
};

export function makeCore(options: {
  scraper?: Partial<Scraper>;
  now?: () => Date;
  verification?: boolean;
  mailer?: Mailer;
  earlyAccessKinds?: readonly string[];
} = {}) {
  return createCore({
    prisma,
    config: {
      ...testConfig,
      emailVerificationRequired: options.verification ?? false,
    },
    mailer: options.mailer ?? makeMailbox().mailer,
    scraper: { ...unusedScraper, ...options.scraper },
    now: options.now ?? (() => new Date()),
    ...(options.earlyAccessKinds ? { earlyAccessKinds: options.earlyAccessKinds } : {}),
  });
}

/** Extracts the token from the first link in a mail body. */
export function tokenFromMail(message: MailMessage): string {
  const match = /token=([^\s&]+)/.exec(message.text);
  if (!match) throw new Error("no token in mail");
  return decodeURIComponent(match[1]!);
}

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "TelegramOutbox", "StatusObservation", "FeedbackMessage", "PaymentIntent", "TrialLedger", "FreeGrant", "AuditLog", "ProfileChange", "TelegramLinkCode", "EmailToken", "Session", "User" RESTART IDENTITY CASCADE',
  );
}

export const adultProfile = {
  firstName: "Egor",
  lastName: "Medvedev",
  birthDate: new Date("1987-07-19T00:00:00Z"),
  pjnJurisdiction: "4",
};

export const PASSWORD = "correct horse battery";

/** Ends the free places (the trial) of an account, so a test can exercise paid places alone. */
export async function endFreePlaces(userId: string): Promise<void> {
  await prisma.freeGrant.updateMany({ where: { userId }, data: { revokedAt: new Date(), expiryHandledAt: new Date() } });
}
