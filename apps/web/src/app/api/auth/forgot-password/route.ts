import { APP_CONFIG, forgotPasswordSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { limitByIp, parseBody } from "@/server/api";
import { getCore } from "@/server/core";

/** Always answers the same, so the form cannot be used to probe for accounts. */
export async function POST(request: Request) {
  const limited = limitByIp(request, "email", APP_CONFIG.rateLimit.email);
  if (limited) return limited;

  const body = await parseBody(request, forgotPasswordSchema);
  if (!body.ok) return body.response;

  await getCore().accounts.requestPasswordReset(body.data.email);
  return NextResponse.json({ ok: true });
}
