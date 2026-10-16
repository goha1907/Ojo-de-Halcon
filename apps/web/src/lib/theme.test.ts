import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { parseTheme, resolveTheme, themeCookie, THEME_INIT_SCRIPT } from "./theme";

function runInit(cookie: string, systemDark: boolean): string | undefined {
  const document = { cookie, documentElement: { dataset: {} as Record<string, string> } };
  const window = { matchMedia: () => ({ matches: systemDark }) };
  runInNewContext(THEME_INIT_SCRIPT, { document, window });
  return document.documentElement.dataset.theme;
}

describe("theme", () => {
  it("accepts only light and dark as explicit choices", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("neon")).toBe("system");
    expect(parseTheme(undefined)).toBe("system");
  });

  it("follows the system only when nothing is fixed", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("stores a fixed choice for a year and clears the cookie for the system choice", () => {
    expect(themeCookie("dark")).toBe("ojo_theme=dark; path=/; max-age=31536000; samesite=lax");
    expect(themeCookie("system")).toContain("max-age=0");
  });

  it("the head script applies the cookie, then the system preference", () => {
    expect(runInit("ojo_theme=dark", false)).toBe("dark");
    expect(runInit("a=1; ojo_theme=light", true)).toBe("light");
    expect(runInit("", true)).toBe("dark");
    expect(runInit("ojo_theme=garbage", false)).toBe("light");
  });
});
