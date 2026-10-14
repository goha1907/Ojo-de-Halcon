import { NextResponse } from "next/server";
import { withUser } from "@/server/api";
import { getCore } from "@/server/core";

/** Marks the onboarding step as done (finished or skipped). */
export async function POST() {
  return withUser(async (user) => {
    await getCore().profile.completeOnboarding(user.id);
    return NextResponse.json({ ok: true });
  });
}
