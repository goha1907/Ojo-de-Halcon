import type { ReactNode } from "react";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-10">{children}</main>;
}
