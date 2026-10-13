import { execFileSync } from "node:child_process";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

const root = path.resolve(import.meta.dirname, "../../..");

/**
 * Applies pending migrations to the dedicated test database once per run.
 * Non-destructive on purpose: wiping the database (prisma migrate reset) is a
 * manual action that needs the owner's consent.
 */
export default function setup(): void {
  loadDotenv({ path: path.join(root, ".env") });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set (run `pnpm db:create-test` and fill .env)");
  }
  try {
    execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      cwd: path.join(root, "packages/db"),
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
    });
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? "";
    throw new Error(`Could not prepare the test database: ${stderr.slice(-800)}`);
  }
}
