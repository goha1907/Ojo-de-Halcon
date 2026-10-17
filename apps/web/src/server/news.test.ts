import { NEWS_COVER_PATTERN } from "@ojo/shared";
import { describe, expect, it } from "vitest";
import { coverOf, DEFAULT_COVER, pickLocale, type NewsItem } from "./news";

describe("pickLocale", () => {
  const item = (slug: string, locale: "ru" | "es", date = "2026-10-14", time = "00:00"): NewsItem => ({
    slug, date, time, locale, title: `${slug}-${locale}`, summary: "", body: "",
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

  it("orders entries of one day by time, newest first", () => {
    const picked = pickLocale(
      [
        item("2026-10-14-morning", "ru", "2026-10-14", "09:00"),
        item("2026-10-14-evening", "ru", "2026-10-14", "18:30"),
        item("2026-10-14-noon", "ru", "2026-10-14", "12:00"),
      ],
      "ru",
    );
    expect(picked.map((n) => n.slug)).toEqual(["2026-10-14-evening", "2026-10-14-noon", "2026-10-14-morning"]);
  });
});

describe("news covers", () => {
  it("accepts built-in pictures and uploaded ones, nothing else", () => {
    expect(NEWS_COVER_PATTERN.test("/news/cabinet.svg")).toBe(true);
    expect(NEWS_COVER_PATTERN.test("/news/photo-1.jpg")).toBe(true);
    expect(NEWS_COVER_PATTERN.test("/api/news/image/cmvabc123")).toBe(true);
    expect(NEWS_COVER_PATTERN.test("https://example.com/x.png")).toBe(false);
    expect(NEWS_COVER_PATTERN.test("/news/../secret.svg")).toBe(false);
    expect(NEWS_COVER_PATTERN.test("/api/news/image/../../x")).toBe(false);
    expect(NEWS_COVER_PATTERN.test("/images/x.svg")).toBe(false);
  });

  it("falls back to the default cover and leaves uploaded addresses alone", () => {
    expect(coverOf({ image: "/api/news/image/cmvabc123" })).toBe("/api/news/image/cmvabc123");
    // a built-in file that is not there keeps its plain address; a real one gets its change time as a version
    expect(coverOf({ image: "/news/not-there.svg" })).toBe("/news/not-there.svg");
    expect(coverOf({ image: undefined })).toMatch(new RegExp(`^${DEFAULT_COVER}(\\?v=\\d+)?$`));
  });
});
