import { APP_CONFIG } from "@ojo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, limitByIp, parseBody } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({ token: z.string().min(1) });

export async function POST(request: Request) {
  const limited = limitByIp(request, "email", APP_CONFIG.rateLimit.email);
  if (limited) return limited;

  const body = await parseBody(request, bodySchema);
  if (!body.ok) return body.response;

  const done = await getCore().accounts.verifyEmail(body.data.token);
  return done ? NextResponse.json({ ok: true }) : apiError("INVALID_TOKEN");
}
