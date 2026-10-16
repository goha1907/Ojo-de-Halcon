import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { logoAsset } from "./brand";

const publicDir = path.resolve(__dirname, "../../public");
const readSvg = (src: string) => readFileSync(path.join(publicDir, src), "utf8");

describe("logoAsset", () => {
  it("picks the artwork by background tone", () => {
    expect(logoAsset("horizontal", "light", 36).src).toBe("/brand/logo-light.svg");
    expect(logoAsset("horizontal", "dark", 36).src).toBe("/brand/logo-dark.svg");
    expect(logoAsset("icon", "dark", 24).src).toBe("/brand/logo-icon-white.svg");
  });

  it("derives the width from the artwork ratio", () => {
    expect(logoAsset("horizontal", "light", 40)).toMatchObject({ width: 204, height: 40 });
    expect(logoAsset("icon", "light", 32)).toMatchObject({ width: 37, height: 32 });
  });

  it("points only at files that exist and ratios that match their viewBox", () => {
    for (const variant of ["horizontal", "icon"] as const) {
      for (const tone of ["light", "dark"] as const) {
        const { src } = logoAsset(variant, tone, 100);
        expect(existsSync(path.join(publicDir, src)), src).toBe(true);
        const [w, h] = readSvg(src).match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!.slice(1).map(Number);
        const { width } = logoAsset(variant, tone, 100);
        expect(Math.abs(width - (w! / h!) * 100)).toBeLessThan(1);
      }
    }
  });
});

describe("brand SVG files", () => {
  const files = [
    "logo-light", "logo-dark", "logo-stacked-light", "logo-stacked-dark", "logo-icon",
    "logo-icon-white", "logo-black", "logo-white", "app-icon-light", "app-icon-dark",
    "favicon", "telegram-avatar",
  ];

  it.each(files)("%s is flat, self-contained vector artwork", (name) => {
    const svg = readSvg(`/brand/${name}.svg`);
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg).not.toMatch(/gradient|<image|<filter|href=|opacity|<script/i);
  });

  it("uses the agreed logo colours", () => {
    expect(readSvg("/brand/logo-light.svg")).toContain('fill="#1F2937"');
    expect(readSvg("/brand/logo-dark.svg")).toContain('fill="#FFFFFF"');
  });
});
