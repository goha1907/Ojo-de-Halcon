import type { PrismaClient } from "@ojo/db";
import type { CapacityService } from "../capacity/capacity-service";

/**
 * "subscription": a paid period is running.
 * "granted": no subscription, but granted places are active (the trial, gifted places).
 * "none": nothing is active: tracking is paused until a subscription is bought.
 */
export type AccessPlan = "subscription" | "granted" | "none";

export interface AccessState {
  plan: AccessPlan;
  /** End of the subscription, or of the granted places (null: they have no end); null when there is none. */
  until: string | null;
  /** May the account be tracked at all right now (paid, or granted places active). */
  active: boolean;
  /** Cases the active granted places cover (trial and gift together). */
  grantedCases: number;
  /** Of them: the trial place. */
  trialCases: number;
  /** Of them: gifted places. */
  giftCases: number;
  /** Kind of the grant that ended last while nothing is active; null otherwise. */
  endedKind: string | null;
}

/** Pure rule: what the paid period and the granted places mean right now. */
export function resolveAccess(
  user: { subscriptionUntil: Date | null },
  granted: { trial: number; gift: number; until: Date | null; lastEnd: Date | null; endedKind?: string | null },
  now: Date,
): AccessState {
  const cases = granted.trial + granted.gift;
  const counts = { grantedCases: cases, trialCases: granted.trial, giftCases: granted.gift };
  if (user.subscriptionUntil && user.subscriptionUntil > now) {
    return {
      plan: "subscription",
      until: user.subscriptionUntil.toISOString(),
      active: true,
      ...counts,
      endedKind: null,
    };
  }
  if (cases > 0) {
    return {
      plan: "granted",
      until: granted.until ? granted.until.toISOString() : null,
      active: true,
      ...counts,
      endedKind: null,
    };
  }
  return {
    plan: "none",
    until: granted.lastEnd ? granted.lastEnd.toISOString() : null,
    active: false,
    ...counts,
    endedKind: granted.endedKind ?? null,
  };
}

export function createAccessService(deps: {
  prisma: PrismaClient;
  now: () => Date;
  capacity: CapacityService;
}) {
  const { prisma, now, capacity } = deps;

  async function get(userId: string): Promise<AccessState> {
    const at = now();
    const [user, places] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { subscriptionUntil: true } }),
      capacity.get(userId, at),
    ]);
    return resolveAccess(
      user,
      {
        trial: places.trial,
        gift: places.gift,
        until: places.grantedUntil,
        lastEnd: places.lastEnd,
        endedKind: places.endedKind,
      },
      at,
    );
  }

  /**
   * Ends the subscription at once and clears the log of the test payment provider (real payments are never
   * touched). Used from the admin area while payments run on the test provider.
   */
  async function resetSubscription(userId: string): Promise<AccessState> {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { subscriptionUntil: null, subscriptionCancelledAt: null, paidCases: 0 },
      }),
      prisma.payment.deleteMany({ where: { userId, provider: "stub" } }),
      prisma.paymentIntent.deleteMany({ where: { userId, provider: "stub" } }),
    ]);
    return get(userId);
  }

  return { get, resetSubscription };
}

export type AccessService = ReturnType<typeof createAccessService>;
