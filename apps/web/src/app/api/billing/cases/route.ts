import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({
  trackerId: z.string().min(1),
  /** remove: leaves the subscription at the next period; restore: takes that back; resume: tracks a paused case again. */
  action: z.enum(["remove", "restore", "resume"]),
});

/** What happens to one case in the subscription. Cases are never deleted. */
export async function PUT(request: Request) {
  return withVerifiedUser(async (user) => {
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const { trackerId, action } = body.data;
    const billing = getCore().billing;
    const result =
      action === "resume"
        ? await billing.resume(user.id, trackerId)
        : await billing.setKept(user.id, trackerId, action === "restore");
    if (!result.ok) return apiError(result.reason === "NO_FREE_SLOT" ? "NO_FREE_SLOT" : result.reason);
    return NextResponse.json({ ok: true });
  });
}
