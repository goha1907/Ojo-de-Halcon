import { existsSync } from "node:fs";
import path from "node:path";
import { getPrisma } from "@ojo/db";
import { APP_CONFIG, type Env } from "@ojo/shared";
import { createCore } from "./index";
import { createConsoleMailer, type Mailer } from "./mailer";
import { createProcessScraper } from "./trackers/scraper";

/** Nearest ancestor of the working directory that holds pnpm-workspace.yaml. */
function findRepoRoot(start: string): string {
  let dir = start;
  while (!existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
  return dir;
}

/** Builds the core services for a running process from validated env. */
export function createCoreFromEnv(env: Env, mailer: Mailer = createConsoleMailer()) {
  const root = findRepoRoot(process.cwd());
  return createCore({
    prisma: getPrisma(env.DATABASE_URL),
    mailer,
    scraper: createProcessScraper({
      python: path.resolve(root, env.SCRAPER_PYTHON),
      cwd: path.resolve(root, env.SCRAPER_DIR),
      timeoutMs: env.SCRAPER_TIMEOUT_SECONDS * 1000,
      concurrency: env.SCRAPER_CONCURRENCY,
    }),
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
      relativesEnabled: env.FEATURE_RELATIVES,
    },
  });
}
