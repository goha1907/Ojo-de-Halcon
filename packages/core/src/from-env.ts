import { getPrisma } from "@ojo/db";
import { APP_CONFIG, type Env } from "@ojo/shared";
import { createCore } from "./index";
import { createConsoleMailer, type Mailer } from "./mailer";

/** Builds the core services for a running process from validated env. */
export function createCoreFromEnv(env: Env, mailer: Mailer = createConsoleMailer()) {
  return createCore({
    prisma: getPrisma(env.DATABASE_URL),
    mailer,
    config: {
      secret: env.SESSION_SECRET,
      appUrl: env.APP_URL,
      sessionTtlDays: env.SESSION_TTL_DAYS,
      telegramLinkCodeTtlMinutes: env.TELEGRAM_LINK_CODE_TTL_MINUTES,
      emailVerificationRequired: env.EMAIL_VERIFICATION_REQUIRED,
      verifyEmailTtlHours: APP_CONFIG.auth.verifyEmailTtlHours,
      resetPasswordTtlMinutes: APP_CONFIG.auth.resetPasswordTtlMinutes,
      linkCodeBytes: APP_CONFIG.auth.linkCodeBytes,
      sessionTokenBytes: APP_CONFIG.auth.sessionTokenBytes,
      emailTokenBytes: APP_CONFIG.auth.emailTokenBytes,
    },
  });
}
