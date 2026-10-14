import type { PrismaClient } from "@ojo/db";
import { APP_CONFIG } from "@ojo/shared";

export type AccessPlan = "subscription" | "trial" | "trial_expired";

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
  user: { trialStartedAt: Date; subscriptionUntil: Date | null },
  now: Date,
): AccessState {
  if (user.subscriptionUntil && user.subscriptionUntil > now) {
    return { plan: "subscription", until: user.subscriptionUntil.toISOString(), active: true };
  }
  // The trial runs from account creation, whether or not anything was tracked yet.
  const end = new Date(user.trialStartedAt.getTime() + APP_CONFIG.limits.trialDays * DAY_MS);
  return end > now
    ? { plan: "trial", until: end.toISOString(), active: true }
    : { plan: "trial_expired", until: end.toISOString(), active: false };
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

  /**
   * TEST ONLY: revokes the subscription or resets the trial (payment goes through billing). The caller (web
   * route) must check the PAYMENTS_STUB flag; real billing replaces this.
   */
  async function stub(userId: string, action: "cancel" | "resetTrial"): Promise<AccessState> {
    if (action === "cancel") {
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionUntil: null, subscriptionCancelledAt: null },
      });
    } else {
      await prisma.user.update({ where: { id: userId }, data: { trialStartedAt: now() } });
    }
    return get(userId);
  }

  return { get, stub };
}

export type AccessService = ReturnType<typeof createAccessService>;
