import { ROUTES } from "@ojo/shared";
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

  const people = await getCore().people.list(user.id);

  return (
    <AppShell userLabel={user.firstName ?? user.email} showMenu={!mustVerify}
      defaultJurisdiction={user.pjnJurisdiction}
      people={people}
    >
      {mustVerify ? <VerifyPending email={user.email} /> : children}
    </AppShell>
  );
}
