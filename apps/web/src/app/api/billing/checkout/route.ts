import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";
import { getEnv } from "@/server/env";

const bodySchema = z.object({ cases: z.number().int().min(1) });

/**
 * Pays for cases. Until a payment provider is connected this is the stub:
 * it confirms the payment immediately and only exists while PAYMENTS_STUB is on.
 * A real provider calls the same core method from its webhook instead.
 */
export async function POST(request: Request) {
  return withVerifiedUser(async (user) => {
    if (!getEnv().PAYMENTS_STUB) return apiError("FORBIDDEN");
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const result = await getCore().billing.checkout(user.id, body.data.cases);
    if (!result.ok) return apiError(result.reason === "LIMIT_REACHED" ? "LIMIT_REACHED" : "INVALID_CASES");
    return NextResponse.json({ ok: true, quote: result.quote });
  });
}
