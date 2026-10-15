import { APP_CONFIG, changePasswordSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiError, limitByUser, parseBody, withUser } from "@/server/api";
import { getCore } from "@/server/core";

/** Changes the password of the signed-in user; every other session is closed. */
export async function PUT(request: Request) {
  return withUser(async (user) => {
    const limited = limitByUser(user.id, "password", APP_CONFIG.rateLimit.password);
    if (limited) return limited;
    const body = await parseBody(request, changePasswordSchema);
    if (!body.ok) return body.response;
    const core = getCore();
    const result = await core.accounts.changePassword(user.id, body.data.currentPassword, body.data.password);
    if (!result.ok) return apiError("INVALID_PASSWORD");
    const token = (await cookies()).get(APP_CONFIG.cookies.session)?.value;
    await core.sessions.destroyOthers(user.id, token);
    return NextResponse.json({ ok: true });
  });
}
