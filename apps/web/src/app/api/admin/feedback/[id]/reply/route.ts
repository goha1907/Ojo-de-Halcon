import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withStaff } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({ text: z.string().max(5000) });

/** Answers an inbox message (simulated: nothing is e-mailed yet) and moves it to "answered". */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withStaff("feedback.manage", async (staff) => {
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const result = await getCore().admin.replyFeedback({ id: staff.id, email: staff.email }, id, body.data.text);
    if (!result.ok) return apiError(result.reason === "NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST");
    return NextResponse.json({ ok: true });
  });
}
