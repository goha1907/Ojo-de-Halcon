import { APP_CONFIG, ROUTES } from "@ojo/shared";
import { NextResponse, type NextRequest } from "next/server";
import { shouldRedirectToLogin } from "@/lib/route-guard";

/** Optimistic gate; real session validation happens in server components and route handlers. */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(APP_CONFIG.cookies.session);
  if (shouldRedirectToLogin(request.nextUrl.pathname, hasSession)) {
    return NextResponse.redirect(new URL(ROUTES.login, request.url));
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
  ],
};
