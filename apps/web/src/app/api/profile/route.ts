import { profileSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { apiError, parseBody, withUser } from "@/server/api";
import { getCore } from "@/server/core";

export async function PUT(request: Request) {
  return withUser(async (user) => {
    const body = await parseBody(request, profileSchema);
    if (!body.ok) return body.response;
    const decision = await getCore().profile.update(user.id, body.data);
    if (!decision.allowed) return apiError("FORBIDDEN");
    return NextResponse.json({ ok: true });
  });
}
