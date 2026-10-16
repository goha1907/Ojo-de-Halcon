import { APP_CONFIG, ROUTES } from "@ojo/shared";
import { NextResponse, type NextRequest } from "next/server";
import { shouldRedirectToLogin } from "@/lib/route-guard";

/** Optimistic gate; real session validation happens in server components and route handlers. */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(APP_CONFIG.cookies.session);
  if (shouldRedirectToLogin(request.nextUrl.pathname, hasSession)) {
    // remember the page the visitor wanted: the login sends them back there
    const target = new URL(ROUTES.login, request.url);
    target.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(target);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/onboarding",
    "/links",
    "/services/:path*",
    "/admin/:path*",
  ],
};
