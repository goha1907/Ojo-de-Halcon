import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/** Random URL-safe token with `bytes` bytes of entropy. */
export function randomToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

export type HashScope = "telegram" | "session" | "email";

/**
 * Keyed hash used for every stored one-time credential (link codes, session
 * and e-mail tokens). Scopes are domain-separated so a value valid in one
 * context can never be replayed in another.
 */
export function keyedHash(pepper: string, scope: HashScope, value: string): string {
  return createHmac("sha256", pepper).update(`${scope}:${value}`).digest("hex");
}

// scrypt parameters (OWASP-recommended minimum: N=2^17, r=8, p=1).
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 } as const;

/** Password hash in the form `scrypt$N$r$p$<salt b64>$<hash b64>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.keylen, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
