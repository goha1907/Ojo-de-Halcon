/**
 * Fixed-window in-memory limiter. Good enough for a single server process;
 * replace with a shared store (Redis/Postgres) before running several instances.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: { windowMs: number; max: number },
  now = Date.now(),
): { allowed: boolean } {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + limit.windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return { allowed: true };
  }
  bucket.count += 1;
  return { allowed: bucket.count <= limit.max };
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}
