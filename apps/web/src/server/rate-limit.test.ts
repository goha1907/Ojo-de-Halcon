import { describe, expect, it } from "vitest";
import { clientIp, rateLimit } from "./rate-limit";

const limit = { windowMs: 1000, max: 2 };

describe("rateLimit", () => {
  it("blocks after max hits inside the window and resets afterwards", () => {
    const key = `test-${Math.random()}`;
    expect(rateLimit(key, limit, 0).allowed).toBe(true);
    expect(rateLimit(key, limit, 10).allowed).toBe(true);
    expect(rateLimit(key, limit, 20).allowed).toBe(false);
    expect(rateLimit(key, limit, 1500).allowed).toBe(true);
  });

  it("keeps keys independent", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    rateLimit(a, limit, 0);
    rateLimit(a, limit, 1);
    expect(rateLimit(a, limit, 2).allowed).toBe(false);
    expect(rateLimit(b, limit, 2).allowed).toBe(true);
  });
});

describe("clientIp", () => {
  it("prefers the first forwarded address", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("local");
  });
});
