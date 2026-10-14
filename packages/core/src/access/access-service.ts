import type { PrismaClient } from "@ojo/db";
import { APP_CONFIG } from "@ojo/shared";

export type AccessPlan = "subscription" | "trial" | "trial_expired" | "none";

export interface AccessState {
  plan: AccessPlan;
  /** End of the subscription or of the trial; null when there is none. */
  until: string | null;
  /** May the account be tracked at all right now (trial running or paid). */
  active: boolean;
}

const DAY_MS = 86_400_000;

/** Pure rule: what a user's dates mean right now. */
export function resolveAccess(
  user: { trialStartedAt: Date | null; subscriptionUntil: Date | null },
  now: Date,
): AccessState {
  if (user.subscriptionUntil && user.subscriptionUntil > now) {
    return { plan: "subscription", until: user.subscriptionUntil.toISOString(), active: true };
  }
  if (user.trialStartedAt) {
    const end = new Date(user.trialStartedAt.getTime() + APP_CONFIG.limits.trialDays * DAY_MS);
    return end > now
      ? { plan: "trial", until: end.toISOString(), active: true }
      : { plan: "trial_expired", until: end.toISOString(), active: false };
  }
  return { plan: "none", until: null, active: true };
}

export function createAccessService(deps: { prisma: PrismaClient; now: () => Date }) {
  const { prisma, now } = deps;

  async function get(userId: string): Promise<AccessState> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { trialStartedAt: true, subscriptionUntil: true },
    });
    return resolveAccess(user, now());
  }

  /** Starts the trial with the first tracker (idempotent). */
  async function startTrialIfNeeded(userId: string): Promise<void> {
    await prisma.user.updateMany({
      where: { id: userId, trialStartedAt: null },
      data: { trialStartedAt: now() },
    });
  }

  /**
   * TEST ONLY: revokes the subscription or resets the trial (payment goes through billing). The caller (web
   * route) must check the PAYMENTS_STUB flag; real billing replaces this.
   */
  async function stub(userId: string, action: "cancel" | "resetTrial"): Promise<AccessState> {
    if (action === "cancel") {
      await prisma.user.update({ where: { id: userId }, data: { subscriptionUntil: null } });
    } else {
      await prisma.user.update({ where: { id: userId }, data: { trialStartedAt: null } });
    }
    return get(userId);
  }

  return { get, startTrialIfNeeded, stub };
}

export type AccessService = ReturnType<typeof createAccessService>;
