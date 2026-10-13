import { APP_CONFIG, ROUTES } from "@ojo/shared";
import type { CreatedSession, UserDto } from "@ojo/core";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getCore } from "./core";
import { getEnv } from "./env";

export function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: getEnv().NODE_ENV === "production",
    path: "/",
  };
}

/** Puts the session token into the response as an httpOnly cookie. */
export function attachSession(response: NextResponse, session: CreatedSession): void {
  response.cookies.set(APP_CONFIG.cookies.session, session.token, {
    ...cookieBase(),
    expires: session.expiresAt,
  });
}

export const getCurrentUser = cache(async (): Promise<UserDto | null> => {
  const token = (await cookies()).get(APP_CONFIG.cookies.session)?.value;
  return getCore().sessions.getUser(token);
});

/** For pages behind the login wall. Redirects anonymous visitors. */
export async function requireUser(): Promise<UserDto> {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.login);
  return user;
}
