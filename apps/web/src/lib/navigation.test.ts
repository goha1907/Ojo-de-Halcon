import { describe, expect, it } from "vitest";
import { NAVIGATION, isActive } from "./navigation";

describe("navigation", () => {
  it("lists the service groups, then the settings pages, in order", () => {
    const groups = NAVIGATION.filter((e) => e.kind === "group");
    expect(groups.map((g) => g.id)).toEqual(["dnm", "renaper", "pjn", "post", "settings"]);
    expect(groups[0]!.kind === "group" && groups[0]!.items.map((i) => i.href)).toEqual([
      "/services/dnm/dni",
      "/services/dnm/citizenship",
    ]);
    expect(groups[1]!.kind === "group" && groups[1]!.items.map((i) => i.href)).toEqual(["/services/renaper/dni"]);
    expect(groups[4]!.kind === "group" && groups[4]!.items.map((i) => i.href)).toEqual([
      "/settings/profile",
      "/settings/notifications",
      "/settings/subscription",
    ]);
  });

  it("has unique ids and hrefs", () => {
    const hrefs = NAVIGATION.flatMap((e) => (e.kind === "link" ? [e.href] : e.items.map((i) => i.href)));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("matches nested paths but not prefixes of other segments", () => {
    expect(isActive("/news", "/news")).toBe(true);
    expect(isActive("/news/2026-10-14-launch", "/news")).toBe(true);
    expect(isActive("/newsletter", "/news")).toBe(false);
  });
});
