import { APP_CONFIG } from "@ojo/shared";
import { describe, expect, it } from "vitest";
import { confirmLookup, isProbing, recordLookup } from "./probe-guard";

const { maxUnconfirmed, windowMs } = APP_CONFIG.probe;

describe("probe guard", () => {
  it("warns one lookup before blocking, then blocks", () => {
    const user = "u-warn";
    const warned: boolean[] = [];
    for (let i = 0; i < maxUnconfirmed; i++) warned.push(recordLookup(user, `k${i}`, 1000).warn);
    expect(warned.filter(Boolean)).toHaveLength(1);
    expect(warned[maxUnconfirmed - 2]).toBe(true);
    expect(isProbing(user, 1000)).toBe(true);
  });

  it("does not count a lookup that ended in adding the case", () => {
    const user = "u-honest";
    for (let i = 0; i < 20; i++) {
      recordLookup(user, `k${i}`, 1000);
      confirmLookup(user, `k${i}`, 1000);
    }
    expect(isProbing(user, 1000)).toBe(false);
  });

  it("counts the same number once", () => {
    const user = "u-same";
    for (let i = 0; i < 10; i++) recordLookup(user, "same", 1000);
    expect(isProbing(user, 1000)).toBe(false);
  });

  it("blocks a flood of lookups even when each one is confirmed", () => {
    const user = "u-flood";
    for (let i = 0; i < APP_CONFIG.probe.maxLookups; i++) {
      recordLookup(user, `k${i}`, 1000);
      confirmLookup(user, `k${i}`, 1000);
    }
    expect(isProbing(user, 1000)).toBe(true);
  });

  it("forgets everything after the window", () => {
    const user = "u-window";
    for (let i = 0; i < maxUnconfirmed; i++) recordLookup(user, `k${i}`, 1000);
    expect(isProbing(user, 1000)).toBe(true);
    expect(isProbing(user, 1000 + windowMs + 1)).toBe(false);
  });
});
