import { ROUTES, TRACKER_KIND_SECTION } from "@ojo/shared";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { VerifyPending } from "@/components/auth/verify-pending";
import { AppShell } from "@/components/layout/app-shell";
import { getCore } from "@/server/core";
import { getEnv } from "@/server/env";
import { requireUser } from "@/server/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const mustVerify = getEnv().EMAIL_VERIFICATION_REQUIRED && !user.emailVerified;
  if (!mustVerify && !user.onboardingDone) redirect(ROUTES.onboarding);

  const core = getCore();
  const [access, trackers, billing] = await Promise.all([
    core.access.get(user.id),
    core.trackers.list(user.id),
    core.billing.state(user.id),
  ]);
  // paid cases of a subscription; finished and paused cases do not occupy one
  const usage = billing.capacity > 0 ? { used: billing.activeCases, limit: billing.capacity } : null;
  const sectionCounts: Record<string, number> = {};
  for (const item of trackers) {
    const section = TRACKER_KIND_SECTION[item.kind];
    sectionCounts[section] = (sectionCounts[section] ?? 0) + 1;
  }
  // without a subscription the trial covers one case; an expired trial covers none
  const addLock = access.plan === "none" ? "expired" : null;

  return (
    <AppShell userLabel={user.email} staff={user.role !== "USER"} earlyAccess={user.earlyAccess} showMenu={!mustVerify}
      access={access}
      addLock={addLock}
      usage={usage}
      defaultBirthDate={user.birthDate}
      sectionCounts={sectionCounts}
    >
      {mustVerify ? <VerifyPending email={user.email} /> : children}
    </AppShell>
  );
}
