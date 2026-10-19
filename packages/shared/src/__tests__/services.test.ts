import { describe, expect, it } from "vitest";
import { USEFUL_LINKS, LINK_GROUPS, findLink } from "../config/links";
import { TRACKER_SECTIONS } from "../domain/events";
import { LEGACY_SERVICE_PATHS, SERVICE_GROUPS, SERVICE_OFFICIAL_LINK, findService, serviceHref } from "../domain/services";
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
    expect(serviceHref("renaper", "dni")).toBe("/services/renaper/dni");
    expect(findService("renaper", "dni")?.section).toBe("dni_production");
    expect(findService("dnm", "citizenship")?.section).toBe("citizenship_dnm");
    expect(findService("renaper", "nope")).toBeNull();
    expect(findService("nope", "dni")).toBeNull();
  });

  it("sends every address of the old menu to a page that exists", () => {
    for (const [from, to] of Object.entries(LEGACY_SERVICE_PATHS)) {
      const [, , group, slug] = to.split("/");
      expect(findService(group!, slug!)).not.toBeNull();
      expect(from.startsWith("/services/")).toBe(true);
      expect(findService(from.split("/")[2]!, from.split("/")[3]!)).toBeNull();
    }
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
