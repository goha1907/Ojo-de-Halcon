import { ROUTES } from "@ojo/shared";

const PROTECTED_PREFIXES = [
  ROUTES.dashboard,
  ROUTES.settings,
  ROUTES.onboarding,
  ROUTES.news,
  ROUTES.links,
  "/services",
];

/**
 * Cheap, optimistic gate for the proxy: only keeps anonymous visitors out of
 * the signed-in area. A cookie's presence proves nothing (it may be stale), so
 * guest-only pages must NOT be redirected from here — they check the real
 * session on the server instead, otherwise a dead cookie causes a redirect loop.
 */
export function shouldRedirectToLogin(pathname: string, hasSessionCookie: boolean): boolean {
  if (hasSessionCookie) return false;
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
