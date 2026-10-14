import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withUser } from "@/server/api";
import { getCore } from "@/server/core";
import { getEnv } from "@/server/env";

const bodySchema = z.object({ action: z.enum(["cancel", "resetTrial"]) });

/** Test stub for payments: only answers when PAYMENTS_STUB is on. */
export async function POST(request: Request) {
  return withUser(async (user) => {
    if (!getEnv().PAYMENTS_STUB) return apiError("FORBIDDEN");
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const access = await getCore().access.stub(user.id, body.data.action);
    return NextResponse.json({ ok: true, access });
  });
}
