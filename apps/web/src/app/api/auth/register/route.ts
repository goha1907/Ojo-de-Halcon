import { APP_CONFIG, registerSchema, resolveLocale } from "@ojo/shared";
import { NextResponse } from "next/server";
import { apiError, limitByIp, parseBody } from "@/server/api";
import { getCore } from "@/server/core";
import { attachSession } from "@/server/session";

export async function POST(request: Request) {
  const limited = limitByIp(request, "register", APP_CONFIG.rateLimit.register);
  if (limited) return limited;

  const body = await parseBody(request, registerSchema);
  if (!body.ok) return body.response;

  const core = getCore();
  const result = await core.accounts.register({
    email: body.data.email,
    password: body.data.password,
    locale: resolveLocale(request.headers.get("accept-language")),
  });
  if (!result.ok) return apiError("EMAIL_TAKEN");

  const session = await core.sessions.create(result.userId);
  const response = NextResponse.json({ ok: true });
  attachSession(response, session);
  return response;
}
