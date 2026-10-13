import { APP_CONFIG } from "@ojo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withUser } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({ password: z.string().min(1) });

export async function DELETE(request: Request) {
  return withUser(async (user) => {
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const result = await getCore().accounts.deleteAccount(user.id, body.data.password);
    if (!result.ok) return apiError("INVALID_PASSWORD");
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(APP_CONFIG.cookies.session);
    return response;
  });
}
