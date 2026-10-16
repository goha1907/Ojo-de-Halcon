import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withStaff } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({
  kind: z.enum(["GIFT", "BONUS", "PROMO", "ADMIN"]),
  cases: z.number().int().min(1).max(100),
  /** ISO date; omitted or null: no end date (renews every month until revoked). */
  expiresAt: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(200).optional(),
  requestId: z.string().min(8).max(64),
});

/** Gives gift places to an account. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withStaff("grants.manage", async (staff) => {
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const result = await getCore().admin.giveGrant(
      { id: staff.id, email: staff.email },
      {
        userId: id,
        kind: body.data.kind,
        cases: body.data.cases,
        expiresAt: body.data.expiresAt ? new Date(body.data.expiresAt) : null,
        note: body.data.note ?? null,
        requestId: body.data.requestId,
      },
    );
    if (!result.ok) return apiError(result.reason === "NOT_FOUND" ? "NOT_FOUND" : result.reason === "DUPLICATE" ? "ALREADY_EXISTS" : "BAD_REQUEST");
    return NextResponse.json({ ok: true, ...result.value });
  });
}
