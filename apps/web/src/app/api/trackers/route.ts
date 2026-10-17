import { APP_CONFIG, addTrackerRequestSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { apiError, limitByUser, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";
import { confirmLookup, isProbing } from "@/server/probe-guard";

/** Adds one tracker (RENAPER, Correo and court cases are independent). */
export async function POST(request: Request) {
  return withVerifiedUser(async (user) => {
    const limited = limitByUser(user.id, "tracker-add", APP_CONFIG.rateLimit.trackerAdd);
    if (limited) return limited;
    const body = await parseBody(request, addTrackerRequestSchema);
    if (!body.ok) return body.response;
    const input = body.data;
    if (isProbing(user.id)) return apiError("PROBING");
    const trackers = getCore().trackers;

    if (input.kind === "PJN") {
      // the user already saw the case header in the preview step and confirmed
      const result = await trackers.addPjn(
        user.id,
        { jurisdiction: input.jurisdiction, number: input.number, year: input.year },
        input.label,
      );
      if (!result.ok) return apiError(result.reason);
      confirmLookup(user.id, `PJN:${input.jurisdiction}:${input.number}/${input.year}`);
      return NextResponse.json({ ok: true, tracker: result.tracker });
    }

    const birthDate = "birthDate" in input ? (input.birthDate ?? null) : null;
    const result = await trackers.addTramite(user.id, input.kind, input.number, input.label, birthDate);
    if (!result.ok) return apiError(result.reason);
    confirmLookup(user.id, `${input.kind}:${input.number}`);
    return NextResponse.json({ ok: true, tracker: result.tracker });
  });
}
