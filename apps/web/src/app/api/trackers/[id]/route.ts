import { NextResponse } from "next/server";
import { apiError, withUser } from "@/server/api";
import { getCore } from "@/server/core";

type Context = { params: Promise<{ id: string }> };

/**
 * Users may only discard a court case they have not confirmed. Finishing or
 * deleting a confirmed case goes through support (subscription limits).
 */
export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return withUser(async (user) => {
    const ok = await getCore().trackers.discardPending(user.id, id);
    return ok ? NextResponse.json({ ok: true }) : apiError("FORBIDDEN");
  });
}
