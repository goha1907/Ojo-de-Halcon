import { personSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { apiError, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

export async function POST(request: Request) {
  return withVerifiedUser(async (user) => {
    const body = await parseBody(request, personSchema);
    if (!body.ok) return body.response;
    const result = await getCore().people.add(user.id, body.data);
    if (!result.ok) return apiError(result.reason);
    return NextResponse.json({ ok: true, person: result.person });
  });
}
