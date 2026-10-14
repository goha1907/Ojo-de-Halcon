import { APP_CONFIG, pjnCaseSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { apiError, limitByUser, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

/** Step one of adding a court case: finds it and shows its header; nothing is stored. */
export async function POST(request: Request) {
  return withVerifiedUser(async (user) => {
    const limited = limitByUser(user.id, "tracker-add", APP_CONFIG.rateLimit.trackerAdd);
    if (limited) return limited;
    const body = await parseBody(request, pjnCaseSchema);
    if (!body.ok) return body.response;
    const result = await getCore().trackers.previewPjn(user.id, body.data);
    if (!result.ok) return apiError(result.reason);
    return NextResponse.json({ ok: true, header: result.header });
  });
}
