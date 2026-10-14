import { APP_CONFIG, addTrackerRequestSchema, pjnReference } from "@ojo/shared";
import { NextResponse } from "next/server";
import { apiError, limitByUser, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

/** Adds one tracker (RENAPER, Correo and court cases are independent). */
export async function POST(request: Request) {
  return withVerifiedUser(async (user) => {
    const limited = limitByUser(user.id, "tracker-add", APP_CONFIG.rateLimit.trackerAdd);
    if (limited) return limited;
    const body = await parseBody(request, addTrackerRequestSchema);
    if (!body.ok) return body.response;
    const input = body.data;
    const trackers = getCore().trackers;

    if (input.kind === "PJN") {
      const result = await trackers.startPjn(
        user.id,
        { jurisdiction: input.jurisdiction, number: input.number, year: input.year },
        input.personId,
      );
      if (!result.ok) return apiError(result.reason);
      return NextResponse.json({
        ok: true,
        tracker: result.tracker,
        reference: pjnReference(input),
        needsConfirmation: true,
      });
    }

    const result = await trackers.addTramite(user.id, input.kind, input.number, input.personId);
    if (!result.ok) return apiError(result.reason);
    return NextResponse.json({ ok: true, tracker: result.tracker });
  });
}
