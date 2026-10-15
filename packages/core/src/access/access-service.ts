import type { PrismaClient } from "@ojo/db";
import { activeGrantWhere, trialGrantData } from "../grants/grant-service";

/**
 * "subscription": a paid period is running.
 * "trial": no subscription, but free places are active (the trial, a bonus, a gift).
 * "trial_expired": neither: tracking is paused until a subscription is bought.
 */
export type AccessPlan = "subscription" | "trial" | "trial_expired";

export interface AccessState {
  plan: AccessPlan;
  /** End of the subscription, or of the free places (null: they have no end); null when there is none. */
  until: string | null;
  /** May the account be tracked at all right now (paid, or free places active). */
  active: boolean;
  /** Cases the active extra places cover (the trial place and bonus ones together). */
  freeCases: number;
  /** Of them: the trial place. */
  trialCases: number;
  /** Of them: bonus, gift and other granted places. */
  bonusCases: number;
  /** Kind of the grant that ended last while nothing is active; null otherwise. */
  endedKind: string | null;
}

/** Pure rule: what the account's paid period and free places mean right now. */
export function resolveAccess(
  user: { subscriptionUntil: Date | null },
  free: { trial: number; bonus: number; until: Date | null; lastEnd: Date | null; endedKind?: string | null },
  now: Date,
): AccessState {
  const cases = free.trial + free.bonus;
  const counts = { freeCases: cases, trialCases: free.trial, bonusCases: free.bonus };
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
      plan: "trial",
      until: free.until ? free.until.toISOString() : null,
      active: true,
      ...counts,
      endedKind: null,
    };
  }
  return {
    plan: "trial_expired",
    until: free.lastEnd ? free.lastEnd.toISOString() : null,
    active: false,
    ...counts,
    endedKind: free.endedKind ?? null,
  };
}

export function createAccessService(deps: { prisma: PrismaClient; now: () => Date }) {
  const { prisma, now } = deps;

  async function get(userId: string): Promise<AccessState> {
    const at = now();
    const [user, active, lastEnded] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { subscriptionUntil: true } }),
      prisma.freeGrant.findMany({
        where: { userId, ...activeGrantWhere(at) },
        select: { cases: true, expiresAt: true, kind: true },
      }),
      prisma.freeGrant.findFirst({
        where: { userId, revokedAt: null, expiresAt: { lte: at } },
        orderBy: { expiresAt: "desc" },
        select: { expiresAt: true, kind: true },
      }),
    ]);
    const trial = active.filter((row) => row.kind === "TRIAL").reduce((total, row) => total + row.cases, 0);
    const bonus = active.filter((row) => row.kind !== "TRIAL").reduce((total, row) => total + row.cases, 0);
    const endless = active.some((row) => row.expiresAt === null);
    const last = active.reduce((max, row) => Math.max(max, row.expiresAt?.getTime() ?? 0), 0);
    return resolveAccess(
      user,
      {
        trial,
        bonus,
        until: active.length === 0 || endless || last === 0 ? null : new Date(last),
        lastEnd: lastEnded?.expiresAt ?? null,
        endedKind: lastEnded?.kind ?? null,
      },
      at,
    );
  }

  /**
   * TEST ONLY: revokes the subscription or starts a fresh trial (payment goes through billing). The caller
   * (web route) must check the PAYMENTS_STUB flag; real billing replaces this.
   */
  async function stub(userId: string, action: "cancel" | "resetTrial"): Promise<AccessState> {
    if (action === "cancel") {
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionUntil: null, subscriptionCancelledAt: null },
      });
    } else {
      await prisma.$transaction([
        prisma.freeGrant.updateMany({
          where: { userId, kind: "TRIAL", revokedAt: null },
          data: { revokedAt: now(), expiryHandledAt: now() },
        }),
        prisma.user.update({ where: { id: userId }, data: { trialStartedAt: now() } }),
        prisma.freeGrant.create({ data: trialGrantData(userId, now(), now()) }),
      ]);
    }
    return get(userId);
  }

  return { get, stub };
}

export type AccessService = ReturnType<typeof createAccessService>;
