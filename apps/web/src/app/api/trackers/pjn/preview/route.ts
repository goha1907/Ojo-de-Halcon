import { APP_CONFIG, pjnCaseSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, limitByUser, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = pjnCaseSchema.and(z.object({ personId: z.string().min(1).nullish() }));

/** Step one of adding a court case: finds it and shows its header; nothing is stored. */
export async function POST(request: Request) {
  return withVerifiedUser(async (user) => {
    const limited = limitByUser(user.id, "tracker-add", APP_CONFIG.rateLimit.trackerAdd);
    if (limited) return limited;
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const { personId, ...input } = body.data;
    const result = await getCore().trackers.previewPjn(user.id, input, personId);
    if (!result.ok) return apiError(result.reason);
    return NextResponse.json({ ok: true, header: result.header });
  });
}
