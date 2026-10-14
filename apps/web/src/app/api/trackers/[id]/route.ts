import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withUser } from "@/server/api";
import { getCore } from "@/server/core";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return withUser(async (user) => {
    const ok = await getCore().trackers.remove(user.id, id);
    return ok ? NextResponse.json({ ok: true }) : apiError("NOT_FOUND");
  });
}

const patchSchema = z.object({ action: z.literal("finish") });

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return withUser(async (user) => {
    const body = await parseBody(request, patchSchema);
    if (!body.ok) return body.response;
    const ok = await getCore().trackers.finish(user.id, id);
    return ok ? NextResponse.json({ ok: true }) : apiError("NOT_FOUND");
  });
}
