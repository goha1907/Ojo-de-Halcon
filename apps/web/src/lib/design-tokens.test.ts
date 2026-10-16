import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const body = css.match(new RegExp(`${selector.replace(/[[\]"]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1]!, m[2]!]));
}
const themes = { light: block(":root"), dark: block('[data-theme="dark"]') };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const TEXT_PAIRS: [string, string][] = [
  ["fg", "bg"], ["fg", "bg-subtle"], ["fg", "surface"],
  ["fg-muted", "bg"], ["fg-muted", "bg-subtle"], ["fg-muted", "surface"],
  ["brand-fg", "brand"], ["brand-fg", "brand-hover"],
  ["success-fg", "success-bg"], ["warning-fg", "warning-bg"],
  ["error-fg", "error-bg"], ["info-fg", "info-bg"],
];
// fg-subtle (#94A3B8, from the palette) is decorative/disabled only: 2.6:1 on white, so it is not checked
const NON_TEXT_PAIRS: [string, string][] = [["ring", "bg"], ["ring", "surface"]];

describe("design tokens", () => {
  it("defines the same tokens for both themes", () => {
    expect(Object.keys(themes.light).length).toBeGreaterThan(20);
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  });

  it("exposes every token as a Tailwind colour", () => {
    for (const name of Object.keys(themes.light)) {
      expect(css, name).toContain(`--color-${name}: var(--${name});`);
    }
  });

  it("uses the agreed brand colours", () => {
    expect(themes.light).toMatchObject({ brand: "#1f2937", bg: "#ffffff", "bg-subtle": "#f8fafc", line: "#e5e7eb", "fg-muted": "#6b7280" });
    expect(themes.dark).toMatchObject({ brand: "#ffffff", bg: "#0f172a", surface: "#1e293b", line: "#334155", "fg-muted": "#cbd5e1" });
  });

  for (const [theme, tokens] of Object.entries(themes)) {
    it.each(TEXT_PAIRS)(`${theme}: %s on %s has AA text contrast (4.5)`, (fg, bg) => {
      expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(4.5);
    });
    it.each(NON_TEXT_PAIRS)(`${theme}: %s on %s has at least 3:1`, (fg, bg) => {
      expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(3);
    });
  }
});
