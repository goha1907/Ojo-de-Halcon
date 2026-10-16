import { randomBytes } from "node:crypto";
import { createCoreFromEnv } from "@ojo/core";
import { loadEnv, passwordSchema } from "@ojo/shared";

/**
 * Creates (or promotes) a staff account:
 *   pnpm admin:create --email you@example.com [--role ADMIN|SUPPORT] [--password "..."] [--reset-password]
 * Without --password a strong one is generated and printed once. An existing account keeps its password
 * unless --reset-password is given.
 */
/** Plain output for a command line tool (the worker's JSON logger is for the running service). */
function say(stream: NodeJS.WriteStream, text: unknown): void {
  stream.write(`${String(text)}\n`);
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const email = option("email");
  const role = (option("role") ?? "ADMIN").toUpperCase();
  if (!email || (role !== "ADMIN" && role !== "SUPPORT")) {
    say(process.stderr, 'Usage: pnpm admin:create --email <email> [--role ADMIN|SUPPORT] [--password "<password>"] [--reset-password]');
    process.exit(2);
  }
  const given = option("password");
  const password = given ?? randomBytes(15).toString("base64url");
  if (!passwordSchema.safeParse(password).success) {
    say(process.stderr, "The password does not meet the rules (length).");
    process.exit(2);
  }
  const core = createCoreFromEnv(loadEnv());
  const result = await core.accounts.createOperator({
    email,
    password,
    role,
    resetPassword: process.argv.includes("--reset-password"),
  });
  say(process.stdout, result.created ? `Created ${role}: ${email}` : `Updated existing account to ${role}: ${email}`);
  if (result.created || process.argv.includes("--reset-password")) {
    say(process.stdout, `Password: ${password}`);
    say(process.stdout, "Shown once: save it, then change it in Settings > Profile > Change password.");
  } else {
    say(process.stdout, "The existing password was kept.");
  }
  process.exit(0);
}

main().catch((error: unknown) => {
  say(process.stderr, error instanceof Error ? error.message : error);
  process.exit(1);
});
