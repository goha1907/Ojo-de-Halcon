import type { Prisma, PrismaClient } from "@ojo/db";
import { APP_CONFIG } from "@ojo/shared";

const DAY_MS = 86_400_000;

/** Why a free place was given. Only labels: all kinds behave the same. */
export const GRANT_KINDS = ["TRIAL", "BONUS", "GIFT", "PROMO", "ADMIN"] as const;
export type GrantKind = (typeof GRANT_KINDS)[number];

export interface FreeGrantDto {
  id: string;
  kind: string;
  cases: number;
  note: string | null;
  startsAt: string;
  /** Null: no end date. */
  expiresAt: string | null;
  active: boolean;
}

export interface FreeCapacity {
  /** Cases covered by the grants that are active now. */
  cases: number;
  /** Latest end among the active grants; null when none is active or one has no end. */
  until: string | null;
}

/** Grants active at a moment: started, not revoked and not past their end. */
export function activeGrantWhere(at: Date): Prisma.FreeGrantWhereInput {
  return {
    revokedAt: null,
    startsAt: { lte: at },
    OR: [{ expiresAt: null }, { expiresAt: { gt: at } }],
  };
}

/** The trial: one place with an explicit end date, `trialDays` after its start. */
export function trialGrantData(userId: string, startedAt: Date, now: Date): Prisma.FreeGrantUncheckedCreateInput {
  const expiresAt = new Date(startedAt.getTime() + APP_CONFIG.limits.trialDays * DAY_MS);
  return {
    userId,
    kind: "TRIAL",
    cases: APP_CONFIG.limits.trialCases,
    grantedBy: "system",
    startsAt: startedAt,
    expiresAt,
    // an already finished trial (a returning mailbox) is not announced
    expiryHandledAt: expiresAt <= now ? now : null,
  };
}

export function createGrantService(deps: { prisma: PrismaClient; now: () => Date }) {
  const { prisma, now } = deps;

  /** Places the grants cover at a moment; `withoutTrial` leaves the trial out (it ends when a subscription starts). */
  async function casesAt(userId: string, at: Date, options: { withoutTrial?: boolean } = {}): Promise<number> {
    const sum = await prisma.freeGrant.aggregate({
      where: {
        userId,
        ...activeGrantWhere(at),
        ...(options.withoutTrial ? { kind: { not: "TRIAL" } } : {}),
      },
      _sum: { cases: true },
    });
    return sum._sum.cases ?? 0;
  }

  /** Free places the user has right now and when they end. */
  async function capacity(userId: string, at: Date = now()): Promise<FreeCapacity> {
    const rows = await prisma.freeGrant.findMany({
      where: { userId, ...activeGrantWhere(at) },
      select: { cases: true, expiresAt: true },
    });
    const cases = rows.reduce((total, row) => total + row.cases, 0);
    const endless = rows.some((row) => row.expiresAt === null);
    const last = rows.reduce<number>((max, row) => Math.max(max, row.expiresAt?.getTime() ?? 0), 0);
    return { cases, until: rows.length === 0 || endless || last === 0 ? null : new Date(last).toISOString() };
  }

  /** The grants worth showing: running, upcoming, and the ones that ended recently. */
  async function list(userId: string): Promise<FreeGrantDto[]> {
    const at = now();
    const since = new Date(at.getTime() - 30 * DAY_MS);
    const rows = await prisma.freeGrant.findMany({
      where: { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: since } }] },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      cases: row.cases,
      note: row.note,
      startsAt: row.startsAt.toISOString(),
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      active: row.startsAt <= at && (row.expiresAt === null || row.expiresAt > at),
    }));
  }

  /**
   * Gives places for free (gift places). Without `expiresAt` they keep going until revoked. Giving places
   * ends the trial place: the trial only exists for an account that has nothing else.
   */
  async function give(input: {
    userId: string;
    kind: GrantKind;
    cases: number;
    expiresAt?: Date | null;
    startsAt?: Date;
    note?: string | null;
    grantedBy?: string | null;
  }): Promise<FreeGrantDto> {
    if (!Number.isInteger(input.cases) || input.cases < 1) throw new Error("cases must be a positive integer");
    if (input.kind === "TRIAL") throw new Error("the trial is created at registration, not given");
    const [, row] = await prisma.$transaction([
      prisma.freeGrant.updateMany({
        where: { userId: input.userId, kind: "TRIAL", revokedAt: null },
        data: { revokedAt: now(), expiryHandledAt: now() },
      }),
      prisma.freeGrant.create({
        data: {
          userId: input.userId,
          kind: input.kind,
          cases: input.cases,
          note: input.note ?? null,
          grantedBy: input.grantedBy ?? null,
          startsAt: input.startsAt ?? now(),
          expiresAt: input.expiresAt ?? null,
        },
      }),
    ]);
    return {
      id: row.id,
      kind: row.kind,
      cases: row.cases,
      note: row.note,
      startsAt: row.startsAt.toISOString(),
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      active: row.startsAt <= now() && (row.expiresAt === null || row.expiresAt > now()),
    };
  }

  /** Changes the end of a grant (null: no end). The ending is processed again when it comes. */
  async function setExpiry(grantId: string, expiresAt: Date | null): Promise<boolean> {
    const result = await prisma.freeGrant.updateMany({
      where: { id: grantId, revokedAt: null },
      data: { expiresAt, expiryHandledAt: null },
    });
    return result.count === 1;
  }

  /** Takes a grant back right away. */
  async function revoke(grantId: string): Promise<boolean> {
    const result = await prisma.freeGrant.updateMany({
      where: { id: grantId, revokedAt: null },
      data: { revokedAt: now(), expiryHandledAt: now() },
    });
    return result.count === 1;
  }

  /**
   * Processes grants that ended: when the owner now has more cases than places, one message
   * ("the free places are over, buy a subscription") is queued for their Telegram. Returns how many
   * grants were processed.
   */
  async function sweepExpired(): Promise<number> {
    const at = now();
    const ended = await prisma.freeGrant.findMany({
      where: { revokedAt: null, expiresAt: { lte: at }, expiryHandledAt: null },
      include: { user: { select: { id: true, telegramId: true, locale: true, subscriptionUntil: true, paidCases: true } } },
    });
    const users = new Map<string, (typeof ended)[number]["user"]>();
    for (const grant of ended) users.set(grant.userId, grant.user);
    for (const user of users.values()) {
      const free = await casesAt(user.id, at);
      const paid = user.subscriptionUntil && user.subscriptionUntil > at ? user.paidCases : 0;
      const occupied = await prisma.tracker.count({
        where: { userId: user.id, status: { in: ["ACTIVE", "PENDING_CONFIRMATION"] } },
      });
      const stopped = occupied - (free + paid);
      if (stopped > 0 && user.telegramId !== null) {
        await prisma.telegramOutbox.create({
          data: {
            telegramId: user.telegramId,
            kind: "free_places_ended",
            locale: user.locale,
            payload: { count: String(stopped) },
          },
        });
      }
    }
    if (ended.length > 0) {
      await prisma.freeGrant.updateMany({
        where: { id: { in: ended.map((grant) => grant.id) } },
        data: { expiryHandledAt: at },
      });
    }
    return ended.length;
  }

  return { casesAt, capacity, list, give, setExpiry, revoke, sweepExpired };
}

export type GrantService = ReturnType<typeof createGrantService>;
