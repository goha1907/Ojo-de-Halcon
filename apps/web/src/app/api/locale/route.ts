import { APP_CONFIG, isLocale } from "@ojo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/server/api";
import { getCore } from "@/server/core";
import { cookieBase, getCurrentUser } from "@/server/session";

const bodySchema = z.object({ locale: z.string().refine(isLocale) });

/** Chooses the interface language: remembered in a cookie, and in the profile when signed in (e-mails and the bot use it). */
export async function PUT(request: Request) {
  const body = await parseBody(request, bodySchema);
  if (!body.ok) return body.response;
  const user = await getCurrentUser();
  if (user) await getCore().profile.setLocale(user.id, body.data.locale);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(APP_CONFIG.cookies.locale, body.data.locale, {
    ...cookieBase(),
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
