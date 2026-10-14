import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({ telegram: z.boolean() });

/** Switches the Telegram notifications of one case. (WhatsApp has no bot yet.) */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withVerifiedUser(async (user) => {
    const { id } = await params;
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const ok = await getCore().trackers.setNotify(user.id, id, body.data.telegram);
    return ok ? NextResponse.json({ ok: true }) : apiError("NOT_FOUND");
  });
}
