import { APP_CONFIG, resetPasswordSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { apiError, limitByIp, parseBody } from "@/server/api";
import { getCore } from "@/server/core";

export async function POST(request: Request) {
  const limited = limitByIp(request, "email", APP_CONFIG.rateLimit.email);
  if (limited) return limited;

  const body = await parseBody(request, resetPasswordSchema);
  if (!body.ok) return body.response;

  const done = await getCore().accounts.resetPassword(body.data.token, body.data.password);
  return done ? NextResponse.json({ ok: true }) : apiError("INVALID_TOKEN");
}
