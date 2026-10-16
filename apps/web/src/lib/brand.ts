/** Brand artwork in `public/brand`: file per variant and background tone, plus the viewBox ratio. */
export type LogoVariant = "horizontal" | "icon";
/** Tone of the surface the logo sits on: "light" = light background, "dark" = dark background. */
export type LogoTone = "light" | "dark";

const ASSETS: Record<LogoVariant, { src: Record<LogoTone, string>; ratio: number }> = {
  horizontal: {
    src: { light: "/brand/logo-light.svg", dark: "/brand/logo-dark.svg" },
    ratio: 530.6 / 104,
  },
  icon: {
    src: { light: "/brand/logo-icon.svg", dark: "/brand/logo-icon-white.svg" },
    ratio: 119.2 / 104,
  },
};

/** File and pixel size for a logo rendered at the given height (width follows the artwork ratio). */
export function logoAsset(variant: LogoVariant, tone: LogoTone, height: number) {
  const { src, ratio } = ASSETS[variant];
  return { src: src[tone], width: Math.round(height * ratio), height };
}
