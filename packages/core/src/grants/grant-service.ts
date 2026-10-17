import type { Prisma, PrismaClient } from "@ojo/db";
import { APP_CONFIG } from "@ojo/shared";
import type { CapacityService } from "../capacity/capacity-service";

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

export function createGrantService(deps: { prisma: PrismaClient; now: () => Date; capacity: CapacityService }) {
  const { prisma, now, capacity: places } = deps;

  /**
   * Ends the trial place (the account got a subscription or bonus places). Returns the query, so it can be
   * part of the same transaction as the event that ends the trial.
   */
  function endTrial(userId: string) {
    return prisma.freeGrant.updateMany({
      where: { userId, kind: "TRIAL", revokedAt: null },
      data: { revokedAt: now(), expiryHandledAt: now() },
    });
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
   * Gives places for free (bonus places). Without `expiresAt` they keep going until revoked. Giving places
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
      endTrial(input.userId),
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
   * Processes grants that ended: when the owner now has more cases than places, one message ("the extra
   * places are over, buy a subscription") is queued for their Telegram. The grants are claimed and the
   * messages queued in one transaction, so a message is never lost or doubled. Returns how many grants
   * were processed.
   */
  async function sweepExpired(): Promise<number> {
    const at = now();
    const ended = await prisma.freeGrant.findMany({
      where: { revokedAt: null, expiresAt: { lte: at }, expiryHandledAt: null },
      include: { user: { select: { id: true, telegramId: true, locale: true } } },
    });
    if (ended.length === 0) return 0;
    const owners = new Map<string, (typeof ended)[number]["user"]>();
    for (const grant of ended) owners.set(grant.userId, grant.user);
    const messages: { telegramId: bigint; locale: string; count: number }[] = [];
    for (const owner of owners.values()) {
      if (owner.telegramId === null) continue;
      const breakdown = await places.get(owner.id, at);
      const occupied = await prisma.tracker.count({
        where: { userId: owner.id, status: { in: ["ACTIVE", "PENDING_CONFIRMATION"] } },
      });
      const stopped = occupied - breakdown.total;
      if (stopped > 0) messages.push({ telegramId: owner.telegramId, locale: owner.locale, count: stopped });
    }
    return prisma.$transaction(async (tx) => {
      // claim first: another worker that got here earlier has already processed (and announced) these
      const claimed = await tx.freeGrant.updateMany({
        where: { id: { in: ended.map((grant) => grant.id) }, expiryHandledAt: null },
        data: { expiryHandledAt: at },
      });
      if (claimed.count !== ended.length) throw new Error("grants were processed concurrently");
      for (const message of messages) {
        await tx.telegramOutbox.create({
          data: {
            telegramId: message.telegramId,
            kind: "free_places_ended",
            locale: message.locale,
            payload: { count: String(message.count) },
          },
        });
      }
      return ended.length;
    });
  }

  return { endTrial, list, give, setExpiry, revoke, sweepExpired };
}

export type GrantService = ReturnType<typeof createGrantService>;
