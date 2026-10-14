import { APP_CONFIG } from "@ojo/shared";
import { NextResponse } from "next/server";
import { apiError, limitByUser, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

type Context = { params: Promise<{ id: string }> };

/** State of a checkout; asking also moves it forward (the provider is read, the purchase applied once). */
export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  return withVerifiedUser(async (user) => {
    const limited = limitByUser(user.id, "payment", APP_CONFIG.rateLimit.payment);
    if (limited) return limited;
    const intent = await getCore().payments.get(user.id, id);
    return intent ? NextResponse.json({ ok: true, intent }) : apiError("NOT_FOUND");
  });
}
