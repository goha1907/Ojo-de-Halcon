import { APP_CONFIG } from "@ojo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, limitByUser, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

/** A copied page is a few kilobytes of text; this keeps a mistaken paste of something huge out. */
const bodySchema = z.object({ text: z.string().min(1).max(60_000) });

/** Updates a manual source (OCASA) from the page its owner copied. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withVerifiedUser(async (user) => {
    const limited = limitByUser(user.id, "tracker-add", APP_CONFIG.rateLimit.trackerAdd);
    if (limited) return limited;
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const result = await getCore().trackers.refreshManual(user.id, id, body.data.text);
    if (!result.ok) {
      if (result.reason === "NO_STEPS") return apiError("VALIDATION", { reason: "NO_STEPS" });
      if (result.reason === "MISMATCH") return apiError("MISMATCH");
      return apiError(result.reason === "NOT_AVAILABLE" ? "NOT_AVAILABLE" : "NOT_FOUND");
    }
    return NextResponse.json({ ok: true, added: result.added });
  });
}
