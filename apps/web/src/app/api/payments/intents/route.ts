import { APP_CONFIG } from "@ojo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, limitByUser, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({
  /** Cases the subscription holds after paying. */
  cases: z.number().int().min(1),
  method: z.string().min(1).max(40),
});

/** Opens a checkout: the amount is fixed here and shown by the payment window. */
export async function POST(request: Request) {
  return withVerifiedUser(async (user) => {
    const limited = limitByUser(user.id, "payment", APP_CONFIG.rateLimit.payment);
    if (limited) return limited;
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const result = await getCore().payments.create(user.id, body.data);
    if (!result.ok) {
      return apiError(
        result.reason === "LIMIT_REACHED"
          ? "LIMIT_REACHED"
          : result.reason === "METHOD_UNAVAILABLE"
            ? "FORBIDDEN"
            : "INVALID_CASES",
      );
    }
    return NextResponse.json({ ok: true, intent: result.intent });
  });
}
