import { trackerLabelSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withUser } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({ label: trackerLabelSchema });

/** Renames a case: the name is a personal note, so it can change at any time. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withUser(async (user) => {
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const ok = await getCore().trackers.setLabel(user.id, id, body.data.label);
    return ok ? NextResponse.json({ ok: true }) : apiError("NOT_FOUND");
  });
}
