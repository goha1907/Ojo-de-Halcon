import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withStaff } from "@/server/api";
import { getCore } from "@/server/core";

type Context = { params: Promise<{ id: string }> };

const expirySchema = z.object({
  expiresAt: z.string().datetime().nullable(),
  requestId: z.string().min(8).max(64).optional(),
});

/** Changes the end date of a grant (null: no end date). */
export async function PUT(request: Request, context: Context) {
  const { id } = await context.params;
  return withStaff("grants.manage", async (staff) => {
    const body = await parseBody(request, expirySchema);
    if (!body.ok) return body.response;
    const result = await getCore().admin.setGrantExpiry(
      { id: staff.id, email: staff.email },
      id,
      body.data.expiresAt ? new Date(body.data.expiresAt) : null,
      body.data.requestId ?? null,
    );
    if (!result.ok) return apiError(result.reason === "NOT_FOUND" ? "NOT_FOUND" : result.reason === "DUPLICATE" ? "ALREADY_EXISTS" : "BAD_REQUEST");
    return NextResponse.json({ ok: true });
  });
}

/** Takes a grant back right away. */
export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return withStaff("grants.manage", async (staff) => {
    const result = await getCore().admin.revokeGrant({ id: staff.id, email: staff.email }, id);
    if (!result.ok) return apiError(result.reason === "NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST");
    return NextResponse.json({ ok: true });
  });
}
