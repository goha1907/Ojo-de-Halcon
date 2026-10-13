import { APP_CONFIG, loginSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { apiError, limitByIp, parseBody } from "@/server/api";
import { getCore } from "@/server/core";
import { attachSession } from "@/server/session";

export async function POST(request: Request) {
  const limited = limitByIp(request, "login", APP_CONFIG.rateLimit.login);
  if (limited) return limited;

  const body = await parseBody(request, loginSchema);
  if (!body.ok) return body.response;

  const core = getCore();
  const result = await core.accounts.login(body.data);
  if (!result.ok) return apiError("INVALID_CREDENTIALS");

  const session = await core.sessions.create(result.userId);
  const response = NextResponse.json({ ok: true });
  attachSession(response, session);
  return response;
}
