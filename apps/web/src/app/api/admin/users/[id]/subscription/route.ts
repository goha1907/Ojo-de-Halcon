import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withStaff } from "@/server/api";
import { getCore } from "@/server/core";
import { getEnv } from "@/server/env";

const bodySchema = z.object({ action: z.enum(["renew", "reset"]) });

/** Test tools for the subscription of an account (only while payments run on the test provider). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withStaff("users.manage", async (staff) => {
    if (!getEnv().PAYMENTS_STUB) return apiError("FORBIDDEN");
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const actor = { id: staff.id, email: staff.email };
    const admin = getCore().admin;
    const result = body.data.action === "renew" ? await admin.renewSubscription(actor, id) : await admin.resetSubscription(actor, id);
    if (!result.ok) return apiError(result.reason === "NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST");
    return NextResponse.json({ ok: true });
  });
}
