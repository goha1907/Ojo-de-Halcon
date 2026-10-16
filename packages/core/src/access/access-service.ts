import type { PrismaClient } from "@ojo/db";
import { activeGrantWhere, type CapacityService } from "../capacity/capacity-service";
import { trialGrantData, type GrantService } from "../grants/grant-service";

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
  grants: GrantService;
}) {
  const { prisma, now, capacity, grants } = deps;

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
   * TEST ONLY (the web route checks the PAYMENTS_STUB flag; real billing replaces this):
   * - cancel: ends the subscription and clears the test payment log (only records of the test provider,
   *   so real payments are never touched);
   * - resetTrial: starts a fresh trial;
   * - giftAdd / giftRemove: adds one gift place for 30 days / takes one back.
   */
  async function stub(
    userId: string,
    action: "cancel" | "resetTrial" | "giftAdd" | "giftRemove",
  ): Promise<AccessState> {
    if (action === "cancel") {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { subscriptionUntil: null, subscriptionCancelledAt: null, paidCases: 0 },
        }),
        prisma.payment.deleteMany({ where: { userId, provider: "stub" } }),
        prisma.paymentIntent.deleteMany({ where: { userId, provider: "stub" } }),
      ]);
    } else if (action === "giftAdd") {
      await grants.give({
        userId,
        kind: "GIFT",
        cases: 1,
        expiresAt: new Date(now().getTime() + 30 * 86_400_000),
        grantedBy: "test",
      });
    } else if (action === "giftRemove") {
      const latest = await prisma.freeGrant.findFirst({
        where: { userId, kind: { not: "TRIAL" }, ...activeGrantWhere(now()) },
        orderBy: { createdAt: "desc" },
      });
      if (latest && latest.cases > 1) {
        await prisma.freeGrant.update({ where: { id: latest.id }, data: { cases: latest.cases - 1 } });
      } else if (latest) {
        await grants.revoke(latest.id);
      }
    } else {
      await prisma.$transaction([
        grants.endTrial(userId),
        prisma.user.update({ where: { id: userId }, data: { trialStartedAt: now() } }),
        prisma.freeGrant.create({ data: trialGrantData(userId, now(), now()) }),
      ]);
    }
    return get(userId);
  }

  return { get, stub };
}

export type AccessService = ReturnType<typeof createAccessService>;
