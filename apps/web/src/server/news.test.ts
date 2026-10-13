import { describe, expect, it } from "vitest";
import { parseFrontmatter, parseNewsFilename, pickLocale, type NewsItem } from "./news";

describe("parseFrontmatter", () => {
  it("reads flat keys and trims the body", () => {
    const { meta, body } = parseFrontmatter('---\ntitle: "Hello: world"\nsummary: Short\n---\n\n# Body\n');
    expect(meta).toEqual({ title: "Hello: world", summary: "Short" });
    expect(body).toBe("# Body");
  });
  it("returns the whole text when there is no frontmatter", () => {
    expect(parseFrontmatter("just text")).toEqual({ meta: {}, body: "just text" });
  });
});

describe("parseNewsFilename", () => {
  it("accepts dated slugs with a known locale only", () => {
    expect(parseNewsFilename("2026-10-14-launch.ru.md")).toEqual({
      slug: "2026-10-14-launch",
      date: "2026-10-14",
      locale: "ru",
    });
    expect(parseNewsFilename("2026-10-14-launch.de.md")).toBeNull();
    expect(parseNewsFilename("launch.ru.md")).toBeNull();
    expect(parseNewsFilename("../2026-10-14-x.ru.md")).toBeNull();
  });
});

describe("pickLocale", () => {
  const item = (slug: string, locale: "ru" | "es", date = "2026-10-14"): NewsItem => ({
    slug, date, locale, title: `${slug}-${locale}`, summary: "", body: "",
  });

  it("prefers the requested locale, falls back to the default and sorts newest first", () => {
    const picked = pickLocale(
      [
        item("2026-10-14-a", "ru"),
        item("2026-10-14-a", "es"),
        item("2026-10-20-b", "ru", "2026-10-20"),
      ],
      "es",
    );
    expect(picked.map((n) => n.title)).toEqual(["2026-10-20-b-ru", "2026-10-14-a-es"]);
  });
});
