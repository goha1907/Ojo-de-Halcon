import { describe, expect, it } from "vitest";
import { daysSince } from "./days";

const now = new Date("2026-10-14T10:00:00Z");

describe("daysSince", () => {
  it("counts whole days from a plain or timestamped date", () => {
    expect(daysSince("2026-10-14", now)).toBe(0);
    expect(daysSince("2026-10-08 12:30:00", now)).toBe(6);
  });

  it("never goes negative and ignores text that is not a date", () => {
    expect(daysSince("2026-10-20", now)).toBe(0);
    expect(daysSince("", now)).toBeNull();
    expect(daysSince(undefined, now)).toBeNull();
    expect(daysSince("14/10/2026", now)).toBeNull();
  });
});
