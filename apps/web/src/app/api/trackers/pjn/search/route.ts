import { APP_CONFIG } from "@ojo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, limitByUser, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

/** Looks for the user's court cases by the profile name and the chosen court. */
const bodySchema = z.object({ personId: z.string().min(1).nullish() });

export async function POST(request: Request) {
  return withVerifiedUser(async (user) => {
    const limited = limitByUser(user.id, "tracker-add", APP_CONFIG.rateLimit.trackerAdd);
    if (limited) return limited;
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const result = await getCore().trackers.findPjnByProfile(user.id, body.data.personId);
    if (!result.ok) return apiError(result.reason);
    return NextResponse.json({ ok: true, candidates: result.candidates });
  });
}
