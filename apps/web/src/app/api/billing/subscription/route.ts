import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({ renew: z.boolean() });

/** Cancels the subscription (it will not renew; cases run to the period end) or returns it. */
export async function PUT(request: Request) {
  return withVerifiedUser(async (user) => {
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const result = await getCore().billing.setRenewal(user.id, body.data.renew);
    if (!result.ok) return apiError(result.reason === "NOT_FOUND" ? "NOT_FOUND" : "SUBSCRIPTION_REQUIRED");
    return NextResponse.json({ ok: true });
  });
}
