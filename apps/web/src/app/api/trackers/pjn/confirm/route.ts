import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withUser } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({ id: z.string().min(1) });

/** The user confirms the found case is theirs: full tracking starts. */
export async function POST(request: Request) {
  return withUser(async (user) => {
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const ok = await getCore().trackers.confirmPjn(user.id, body.data.id);
    return ok ? NextResponse.json({ ok: true }) : apiError("NOT_FOUND");
  });
}
