import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, withUser } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({
  services: z.record(z.string(), z.boolean()),
  /** Set by the onboarding screen: this save also finishes onboarding. */
  completeOnboarding: z.boolean().optional(),
});

export async function PUT(request: Request) {
  return withUser(async (user) => {
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const core = getCore();
    await core.preferences.set(user.id, body.data.services);
    if (body.data.completeOnboarding) await core.profile.completeOnboarding(user.id);
    return NextResponse.json({ ok: true });
  });
}
