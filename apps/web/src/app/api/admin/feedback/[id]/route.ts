import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withStaff } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({ status: z.enum(["NEW", "READ", "ANSWERED", "SPAM"]) });

/** Moves an inbox message to another status. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withStaff("feedback.manage", async (staff) => {
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const result = await getCore().admin.setFeedbackStatus({ id: staff.id, email: staff.email }, id, body.data.status);
    if (!result.ok) return apiError(result.reason === "NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST");
    return NextResponse.json({ ok: true });
  });
}
