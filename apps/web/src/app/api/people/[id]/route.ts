import { personSchema } from "@ojo/shared";
import { z } from "zod";
import { NextResponse } from "next/server";
import { apiError, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  const { id } = await context.params;
  return withVerifiedUser(async (user) => {
    const body = await parseBody(request, personSchema);
    if (!body.ok) return body.response;
    const result = await getCore().people.update(user.id, id, body.data);
    if (!result.ok) return apiError(result.reason);
    return NextResponse.json({ ok: true, person: result.person });
  });
}

const notifySchema = z.object({ notifyTelegram: z.boolean() });

/** Turns Telegram updates for this relative on or off. */
export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return withVerifiedUser(async (user) => {
    const body = await parseBody(request, notifySchema);
    if (!body.ok) return body.response;
    const ok = await getCore().people.setNotify(user.id, id, body.data.notifyTelegram);
    return ok ? NextResponse.json({ ok: true }) : apiError("PERSON_NOT_FOUND");
  });
}
