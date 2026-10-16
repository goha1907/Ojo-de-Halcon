import { APP_CONFIG } from "@ojo/shared";

/** What the visitor picked: a fixed theme, or "system" (follow the device). */
export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export type ResolvedTheme = "light" | "dark";

/** One year, in seconds. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Anything that is not an explicit "light" or "dark" means: follow the system. */
export function parseTheme(raw: string | null | undefined): ThemeChoice {
  return raw === "light" || raw === "dark" ? raw : "system";
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): ResolvedTheme {
  if (choice === "system") return systemDark ? "dark" : "light";
  return choice;
}

/** Cookie string that stores the choice; "system" removes the cookie. */
export function themeCookie(choice: ThemeChoice): string {
  const name = APP_CONFIG.cookies.theme;
  return choice === "system"
    ? `${name}=; path=/; max-age=0; samesite=lax`
    : `${name}=${choice}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Inline script for <head>: sets `data-theme` before the first paint, so a visitor who follows the
 * system theme never sees a flash of the wrong one. Explicit choices are also set on the server.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${APP_CONFIG.cookies.theme}=([^;]*)/);var c=m?m[1]:"";var d=c==="dark"||(c!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})();`;
