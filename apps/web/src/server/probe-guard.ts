import { APP_CONFIG } from "@ojo/shared";

/**
 * Protection against probing: somebody types number after number to read the first lines of other people's
 * cases and never adds any. Every source read at the "preview" step is remembered as unconfirmed until the user
 * actually adds that case. A few unconfirmed lookups bring a warning, one more brings a block for the rest of
 * the window. In-memory like the rate limiter: enough for one server process.
 */
interface Entry {
  resetAt: number;
  lookups: number;
  unconfirmed: Set<string>;
}

const entries = new Map<string, Entry>();

function entryOf(userId: string, now: number): Entry {
  let entry = entries.get(userId);
  if (!entry || entry.resetAt <= now) {
    entry = { resetAt: now + APP_CONFIG.probe.windowMs, lookups: 0, unconfirmed: new Set() };
    entries.set(userId, entry);
    if (entries.size > 10_000) {
      for (const [id, other] of entries) if (other.resetAt <= now) entries.delete(id);
    }
  }
  return entry;
}

/** Is this user refused any more lookups right now (blocked for probing, or too many lookups). */
export function isProbing(userId: string, now = Date.now()): boolean {
  const entry = entryOf(userId, now);
  return entry.unconfirmed.size >= APP_CONFIG.probe.maxUnconfirmed || entry.lookups >= APP_CONFIG.probe.maxLookups;
}

/**
 * Counts a lookup that read a source. Returns true when the next unconfirmed lookup will block the user,
 * so the page can warn before that happens.
 */
export function recordLookup(userId: string, key: string, now = Date.now()): { warn: boolean } {
  const entry = entryOf(userId, now);
  entry.lookups += 1;
  entry.unconfirmed.add(key);
  return { warn: entry.unconfirmed.size === APP_CONFIG.probe.maxUnconfirmed - 1 };
}

/** The user added the case they looked up: that lookup was honest. */
export function confirmLookup(userId: string, key: string, now = Date.now()): void {
  entryOf(userId, now).unconfirmed.delete(key);
}
