import { APP_CONFIG, ROUTES } from "@ojo/shared";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = [ROUTES.dashboard, ROUTES.settings, ROUTES.onboarding, ROUTES.news, ROUTES.links, "/services"];
const GUEST_ONLY = [ROUTES.login, ROUTES.register];

/**
 * Optimistic cookie-presence gate. Real session validation happens in the
 * server components/route handlers; this only avoids useless round trips.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(APP_CONFIG.cookies.session);

  if (!hasSession && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.redirect(new URL(ROUTES.login, request.url));
  }
  if (hasSession && GUEST_ONLY.includes(pathname as (typeof GUEST_ONLY)[number])) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/onboarding",
    "/news/:path*",
    "/links",
    "/services/:path*",
    "/login",
    "/register",
  ],
};
