import { APP_CONFIG } from "@ojo/shared";
import { NextResponse } from "next/server";
import { apiError, limitByUser, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

/** Looks for the user's court cases by the profile name and the chosen court. */
export async function POST() {
  return withVerifiedUser(async (user) => {
    const limited = limitByUser(user.id, "tracker-add", APP_CONFIG.rateLimit.trackerAdd);
    if (limited) return limited;
    const result = await getCore().trackers.findPjnByProfile(user.id);
    if (!result.ok) return apiError(result.reason);
    return NextResponse.json({ ok: true, candidates: result.candidates });
  });
}
