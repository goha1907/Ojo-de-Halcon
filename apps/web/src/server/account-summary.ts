import { type UserDto } from "@ojo/core";
import { getCore } from "@/server/core";
import { getEnv } from "@/server/env";

/** What the account menu on public pages shows: the places of the subscription and what it costs. */
export interface AccountSummary {
  /** Signed in and past e-mail verification and onboarding: the cabinet is open for them. */
  cabinetReady: boolean;
  paid: number;
  used: number;
  free: number;
  /** Price of the running period; 0 without a paid subscription. */
  price: number;
  currency: string;
  /** Inputs of the "add tracking" modal. */
  usage: { used: number; limit: number } | null;
  addLock: "trial" | "expired" | null;
  defaultJurisdiction: string | null;
  defaultBirthDate: string | null;
}

export async function loadAccountSummary(user: UserDto): Promise<AccountSummary> {
  const cabinetReady = user.onboardingDone && !(getEnv().EMAIL_VERIFICATION_REQUIRED && !user.emailVerified);
  const base = {
    cabinetReady,
    defaultJurisdiction: user.pjnJurisdiction,
    defaultBirthDate: user.birthDate,
  };
  if (!cabinetReady) {
    return { ...base, paid: 0, used: 0, free: 0, price: 0, currency: "ARS", usage: null, addLock: null };
  }
  const core = getCore();
  const [access, billing] = await Promise.all([core.access.get(user.id), core.billing.state(user.id)]);
  return {
    ...base,
    paid: billing.paidCases,
    used: billing.activeCases,
    free: billing.freeCases,
    price: billing.paidCases > 0 ? billing.currentPrice : 0,
    currency: billing.currency,
    // same rules as the cabinet layout: paid places are the limit; without any plan the trial is over
    usage: billing.capacity > 0 ? { used: billing.activeCases, limit: billing.capacity } : null,
    addLock: access.plan === "none" ? "expired" : null,
  };
}
