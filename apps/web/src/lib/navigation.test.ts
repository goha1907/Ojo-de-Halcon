import { describe, expect, it } from "vitest";
import { NAVIGATION, isActive } from "./navigation";

describe("navigation", () => {
  it("lists the two service groups with their items in order", () => {
    const groups = NAVIGATION.filter((e) => e.kind === "group");
    expect(groups.map((g) => g.id)).toEqual(["dni", "citizenship"]);
    expect(groups[0]!.kind === "group" && groups[0]!.items.map((i) => i.href)).toEqual([
      "/services/dni/migraciones",
      "/services/dni/renaper",
      "/services/dni/correo",
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
