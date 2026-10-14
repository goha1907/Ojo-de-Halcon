import { personSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { apiError, parseBody, withUser } from "@/server/api";
import { getCore } from "@/server/core";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  const { id } = await context.params;
  return withUser(async (user) => {
    const body = await parseBody(request, personSchema);
    if (!body.ok) return body.response;
    const result = await getCore().people.update(user.id, id, body.data);
    if (!result.ok) return apiError(result.reason);
    return NextResponse.json({ ok: true, person: result.person });
  });
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return withUser(async (user) => {
    const ok = await getCore().people.remove(user.id, id);
    return ok ? NextResponse.json({ ok: true }) : apiError("PERSON_NOT_FOUND");
  });
}
