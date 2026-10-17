import { APP_CONFIG, pjnCaseSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { apiError, limitByUser, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";
import { isProbing, recordLookup } from "@/server/probe-guard";

/** Step one of adding a court case: finds it and shows its header; nothing is stored. */
export async function POST(request: Request) {
  return withVerifiedUser(async (user) => {
    const limited = limitByUser(user.id, "tracker-add", APP_CONFIG.rateLimit.trackerAdd);
    if (limited) return limited;
    if (isProbing(user.id)) return apiError("PROBING");
    const body = await parseBody(request, pjnCaseSchema);
    if (!body.ok) return body.response;
    const { jurisdiction, number, year } = body.data;
    const key = `PJN:${jurisdiction}:${number}/${year}`;
    const result = await getCore().trackers.previewPjn(user.id, body.data);
    if (!result.ok) {
      if (result.reason === "NOT_FOUND") return apiError(result.reason, recordLookup(user.id, key));
      return apiError(result.reason);
    }
    return NextResponse.json({ ok: true, header: result.header, ...recordLookup(user.id, key) });
  });
}
