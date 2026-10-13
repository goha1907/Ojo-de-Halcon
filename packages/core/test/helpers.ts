import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { createPrismaClient } from "@ojo/db";
import { createCore, type CoreConfig, type MailMessage, type Mailer } from "../src/index";

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
};

export function makeMailbox() {
  const sent: MailMessage[] = [];
  const mailer: Mailer = { send: async (message) => void sent.push(message) };
  return { sent, mailer };
}

export function makeCore(options: {
  now?: () => Date;
  verification?: boolean;
  mailer?: Mailer;
} = {}) {
  return createCore({
    prisma,
    config: { ...testConfig, emailVerificationRequired: options.verification ?? false },
    mailer: options.mailer ?? makeMailbox().mailer,
    now: options.now ?? (() => new Date()),
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
    'TRUNCATE TABLE "ProfileChange", "ServicePreference", "TelegramLinkCode", "EmailToken", "Session", "User" RESTART IDENTITY CASCADE',
  );
}

export const adultProfile = {
  firstName: "Egor",
  lastName: "Medvedev",
  birthDate: new Date("1987-07-19T00:00:00Z"),
};

export const PASSWORD = "correct horse battery";
