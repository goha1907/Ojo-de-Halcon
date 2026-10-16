import { ROUTES } from "@ojo/shared";

const PROTECTED_PREFIXES = [
  ROUTES.dashboard,
  ROUTES.settings,
  ROUTES.onboarding,
  ROUTES.links,
  "/services",
  "/admin",
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

/**
 * Where to go after signing in: the page the visitor wanted, if it is a path inside this site. Anything
 * else (another site, a protocol, a double slash) is ignored, so the login page cannot be used to bounce
 * people elsewhere.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || value.length > 300) return null;
  if (!/^\/(?!\/)[A-Za-z0-9\-._~/%?=&]*$/.test(value)) return null;
  return value;
}
