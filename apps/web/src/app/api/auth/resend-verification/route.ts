import { APP_CONFIG } from "@ojo/shared";
import { NextResponse } from "next/server";
import { limitByIp, withUser } from "@/server/api";
import { getCore } from "@/server/core";

export async function POST(request: Request) {
  const limited = limitByIp(request, "email", APP_CONFIG.rateLimit.email);
  if (limited) return limited;
  return withUser(async (user) => {
    await getCore().accounts.sendVerificationEmail(user.id);
    return NextResponse.json({ ok: true });
  });
}
