import { Prisma, type PrismaClient } from "@ojo/db";
import { MANUAL_KINDS } from "@ojo/shared";

/**
 * The one place that says how many places an account has and which cases they cover.
 *
 * Places: the paid ones of a running subscription plus the granted ones (the trial, gifts). Cases take
 * granted places first, then paid ones; when places run out the newest cases wait. Everything that needs
 * a number of places (adding a case, polling, billing, the cabinet) goes through here, so the rule has a
 * single definition (the SQL form below must stay equal to `get`, a test checks it).
 */
export interface PlaceBreakdown {
  /** Paid places of a running subscription (0 when none runs). */
  paid: number;
  /** Active trial places. */
  trial: number;
  /** Active places granted for another reason (gift, partner). */
  gift: number;
  /** trial + gift */
  granted: number;
  /** paid + granted: how many cases can be tracked right now. */
  total: number;
  /** A subscription period is running. */
  running: boolean;
  /** Latest end among the active grants; null when none is active or one has no end date. */
  grantedUntil: Date | null;
  /**
   * The nearest end among the active bonus places (the trial is not a gift) and how many places end that day (UTC).
   * Null when no gift place has an end date. After that day the numbers move to the next end.
   */
  giftNextEnd: { at: Date; cases: number } | null;
  /** End and kind of the grant that ended last (used when nothing is active). */
  lastEnd: Date | null;
  endedKind: string | null;
}

/** Grants active at a moment: started, not revoked and not past their end. */
export function activeGrantWhere(at: Date): Prisma.FreeGrantWhereInput {
  return {
    revokedAt: null,
    startsAt: { lte: at },
    OR: [{ expiresAt: null }, { expiresAt: { gt: at } }],
  };
}

export function createCapacityService(deps: { prisma: PrismaClient; now: () => Date }) {
  const { prisma, now } = deps;

  async function get(userId: string, at: Date = now()): Promise<PlaceBreakdown> {
    const [user, active, lastEnded] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { subscriptionUntil: true, paidCases: true },
      }),
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
    const running = user.subscriptionUntil !== null && user.subscriptionUntil > at;
    const trial = active.filter((row) => row.kind === "TRIAL").reduce((total, row) => total + row.cases, 0);
    const gift = active.filter((row) => row.kind !== "TRIAL").reduce((total, row) => total + row.cases, 0);
    const endless = active.some((row) => row.expiresAt === null);
    const last = active.reduce((max, row) => Math.max(max, row.expiresAt?.getTime() ?? 0), 0);
    const paid = running ? user.paidCases : 0;
    const giftEnds = active.filter((row) => row.kind !== "TRIAL" && row.expiresAt !== null) as Array<{ cases: number; expiresAt: Date }>;
    const nextEnd = giftEnds.reduce<Date | null>((min, row) => (min === null || row.expiresAt < min ? row.expiresAt : min), null);
    const giftNextEnd = nextEnd
      ? {
          at: nextEnd,
          cases: giftEnds
            .filter((row) => row.expiresAt.toISOString().slice(0, 10) === nextEnd.toISOString().slice(0, 10))
            .reduce((total, row) => total + row.cases, 0),
        }
      : null;
    return {
      paid,
      trial,
      gift,
      granted: trial + gift,
      total: paid + trial + gift,
      running,
      grantedUntil: active.length === 0 || endless || last === 0 ? null : new Date(last),
      giftNextEnd,
      lastEnd: lastEnded?.expiresAt ?? null,
      endedKind: lastEnded?.kind ?? null,
    };
  }

  /**
   * Granted places at a moment. `withoutTrial` leaves the trial out: it ends when a subscription starts,
   * so it never covers a coming period.
   */
  async function grantedAt(userId: string, at: Date, options: { withoutTrial?: boolean } = {}): Promise<number> {
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

  /**
   * Ids of the active cases that are due and covered by a place of their owner. Cases of one owner take
   * places oldest first, so when places run out the newest ones wait without being touched, and they
   * resume by themselves once places exist again. Manual sources (OCASA) take a place but are never due: they
   * only change when their owner updates them. (SQL form of `get`.)
   */
  async function coveredDueIds(limit: number): Promise<string[]> {
    const at = now();
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      WITH capacity AS (
        SELECT u."id" AS "userId",
          (CASE WHEN u."subscriptionUntil" > ${at} THEN u."paidCases" ELSE 0 END)
          + COALESCE((
              SELECT SUM(g."cases") FROM "FreeGrant" g
              WHERE g."userId" = u."id" AND g."revokedAt" IS NULL AND g."startsAt" <= ${at}
                AND (g."expiresAt" IS NULL OR g."expiresAt" > ${at})
            ), 0) AS "places"
        FROM "User" u
      ), ranked AS (
        SELECT t."id", t."userId", t."status"::text AS "status", t."kind"::text AS "kind", t."nextCheckAt",
          ROW_NUMBER() OVER (PARTITION BY t."userId" ORDER BY t."slotSince", t."createdAt", t."id") AS "rank"
        FROM "Tracker" t
        WHERE t."status"::text IN ('ACTIVE', 'PENDING_CONFIRMATION')
      )
      SELECT r."id" FROM ranked r
      JOIN capacity c ON c."userId" = r."userId"
      WHERE r."status" = 'ACTIVE' AND r."nextCheckAt" <= ${at} AND r."rank" <= c."places"
        AND r."kind" NOT IN (${Prisma.join(MANUAL_KINDS)})
      ORDER BY r."nextCheckAt" ASC
      LIMIT ${limit}`);
    return rows.map((row) => row.id);
  }

  return { get, grantedAt, coveredDueIds };
}

export type CapacityService = ReturnType<typeof createCapacityService>;
