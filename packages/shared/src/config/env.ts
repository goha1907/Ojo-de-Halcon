import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  TELEGRAM_BOT_USERNAME: z
    .string()
    .default("")
    .transform((value) => value.replace(/^@/, "").trim()),
  TELEGRAM_LINK_CODE_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  /**
   * When "true", unverified e-mails cannot use the product. Left "false"
   * until a mail provider is connected: accounts are then created verified.
   */
  /** Scraper virtualenv interpreter and package dir; relative paths resolve from the repo root. */
  SCRAPER_PYTHON: z.string().default("services/scraper/.venv/bin/python"),
  SCRAPER_DIR: z.string().default("services/scraper"),
  SCRAPER_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(150),
  SCRAPER_CONCURRENCY: z.coerce.number().int().positive().default(1),
  EMAIL_VERIFICATION_REQUIRED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Parses and caches process.env. Throws a readable error when misconfigured. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  if (cached && source === process.env) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${problems}`);
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}

/** Test helper: forget the cached environment. */
export function resetEnvCache(): void {
  cached = undefined;
}
