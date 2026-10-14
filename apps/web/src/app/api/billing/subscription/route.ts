import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({ kept: z.boolean() });

/** Cancels the whole subscription (cases run to the period end) or takes the cancellation back. */
export async function PUT(request: Request) {
  return withVerifiedUser(async (user) => {
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const result = await getCore().billing.setSubscriptionKept(user.id, body.data.kept);
    if (!result.ok) return apiError(result.reason === "NOT_FOUND" ? "NOT_FOUND" : "SUBSCRIPTION_REQUIRED");
    return NextResponse.json({ ok: true });
  });
}
