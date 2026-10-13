import { describe, expect, it } from "vitest";
import { USEFUL_LINKS, LINK_GROUPS, findLink } from "../config/links";
import { TRACKER_SECTIONS } from "../domain/events";
import { SERVICE_GROUPS, SERVICE_OFFICIAL_LINK, findService, serviceHref } from "../domain/services";
import { ru } from "../i18n/ru";

describe("service navigation", () => {
  it("covers every tracker section exactly once", () => {
    const sections = SERVICE_GROUPS.flatMap((g) => g.items.map((i) => i.section));
    expect([...sections].sort()).toEqual([...TRACKER_SECTIONS].sort());
  });

  it("has unique slugs inside a group and labels in the dictionary", () => {
    for (const group of SERVICE_GROUPS) {
      const slugs = group.items.map((i) => i.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      expect(`menu.group.${group.key}` in ru).toBe(true);
      for (const item of group.items) expect(`menu.${item.section}` in ru).toBe(true);
    }
  });

  it("builds and resolves hrefs", () => {
    expect(serviceHref("dni", "renaper")).toBe("/services/dni/renaper");
    expect(findService("dni", "renaper")?.section).toBe("dni_production");
    expect(findService("dni", "nope")).toBeNull();
    expect(findService("nope", "renaper")).toBeNull();
  });

  it("links every service to an existing official page", () => {
    for (const section of TRACKER_SECTIONS) {
      expect(findLink(SERVICE_OFFICIAL_LINK[section])).toBeDefined();
    }
  });
});

describe("useful links catalog", () => {
  it("has unique ids, https urls, known groups and translated titles", () => {
    const ids = USEFUL_LINKS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const link of USEFUL_LINKS) {
      expect(link.url.startsWith("https://")).toBe(true);
      expect(LINK_GROUPS).toContain(link.group);
      expect(`links.item.${link.id}` in ru).toBe(true);
    }
    for (const group of LINK_GROUPS) expect(`links.group.${group}` in ru).toBe(true);
  });
});
