import type { PrismaClient } from "@ojo/db";
import { keyedHash, randomToken } from "../crypto";
import type { CoreConfig } from "../types";

export interface TelegramIdentity {
  id: bigint | number | string;
  username?: string | null;
}

export type LinkConfirmResult =
  | { ok: true; userId: string; locale: string }
  | { ok: false; reason: "UNKNOWN_CODE" | "EXPIRED" | "ALREADY_LINKED" };

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/** After this many failed deliveries a message is given up on. */
const OUTBOX_MAX_ATTEMPTS = 5;
/** A claimed message that was never confirmed is picked up again after this time. */
const CLAIM_TIMEOUT_MS = 5 * 60_000;

export function createTelegramService(deps: {
  prisma: PrismaClient;
  config: CoreConfig;
  now: () => Date;
}) {
  const { prisma, config, now } = deps;

  /** Issues a fresh one-time code for the signed-in user (replaces the old one). */
  async function createLinkCode(userId: string): Promise<{ code: string; expiresAt: Date }> {
    const code = randomToken(config.linkCodeBytes);
    const expiresAt = new Date(now().getTime() + config.telegramLinkCodeTtlMinutes * 60_000);
    const codeHash = keyedHash(config.secret, "telegram", code);
    await prisma.telegramLinkCode.upsert({
      where: { userId },
      create: { userId, codeHash, expiresAt },
      update: { codeHash, expiresAt, createdAt: now() },
    });
    return { code, expiresAt };
  }

  /** Called by the bot on `/start <code>`: binds the chat to the code's owner. */
  async function confirmFromBot(input: { code: string; telegram: TelegramIdentity }): Promise<LinkConfirmResult> {
    const record = await prisma.telegramLinkCode.findUnique({
      where: { codeHash: keyedHash(config.secret, "telegram", input.code) },
    });
    if (!record) return { ok: false, reason: "UNKNOWN_CODE" };
    if (record.expiresAt <= now()) {
      await prisma.telegramLinkCode.deleteMany({ where: { id: record.id } });
      return { ok: false, reason: "EXPIRED" };
    }

    const telegramId = BigInt(input.telegram.id);
    const owner = await prisma.user.findUnique({ where: { telegramId } });
    if (owner && owner.id !== record.userId) return { ok: false, reason: "ALREADY_LINKED" };

    try {
      return await prisma.$transaction(async (tx): Promise<LinkConfirmResult> => {
        // Atomic claim: a code works exactly once.
        const claimed = await tx.telegramLinkCode.deleteMany({ where: { id: record.id } });
        if (claimed.count !== 1) return { ok: false, reason: "UNKNOWN_CODE" };
        const user = await tx.user.update({
          where: { id: record.userId },
          data: {
            telegramId,
            telegramUsername: input.telegram.username ?? null,
            telegramLinkedAt: now(),
          },
        });
        return { ok: true, userId: user.id, locale: user.locale };
      });
    } catch (error) {
      if (isUniqueViolation(error)) return { ok: false, reason: "ALREADY_LINKED" };
      throw error;
    }
  }

  async function unlink(userId: string): Promise<void> {
    // The unlink itself decides whether a message is queued, so two concurrent
    // requests (double click, retry) produce exactly one farewell.
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { telegramId: true, locale: true },
      });
      if (!user || user.telegramId === null) return;
      const released = await tx.user.updateMany({
        where: { id: userId, telegramId: user.telegramId },
        data: { telegramId: null, telegramUsername: null, telegramLinkedAt: null },
      });
      if (released.count === 1) {
        await tx.telegramOutbox.create({
          data: { telegramId: user.telegramId, kind: "unlinked", locale: user.locale },
        });
      }
      await tx.telegramLinkCode.deleteMany({ where: { userId } });
    });
  }

  async function purgeExpired(): Promise<number> {
    const result = await prisma.telegramLinkCode.deleteMany({ where: { expiresAt: { lt: now() } } });
    // delivered (or given-up) outbox rows are only kept for a day
    const dayAgo = new Date(now().getTime() - 86_400_000);
    await prisma.telegramOutbox.deleteMany({
      where: { createdAt: { lt: dayAgo }, OR: [{ sentAt: { not: null } }, { attempts: { gte: OUTBOX_MAX_ATTEMPTS } }] },
    });
    return result.count;
  }

  /**
   * Takes messages for delivery. Each row is claimed atomically, so several
   * workers (or an overlapping tick) never send the same message twice. A claim
   * that was not completed is retried after `CLAIM_TIMEOUT_MS`.
   */
  async function claimOutbox(limit = 50) {
    const staleBefore = new Date(now().getTime() - CLAIM_TIMEOUT_MS);
    const candidates = await prisma.telegramOutbox.findMany({
      where: {
        sentAt: null,
        attempts: { lt: OUTBOX_MAX_ATTEMPTS },
        OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    const claimed = [];
    for (const item of candidates) {
      const result = await prisma.telegramOutbox.updateMany({
        where: {
          id: item.id,
          sentAt: null,
          OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
        },
        data: { claimedAt: now() },
      });
      if (result.count === 1) claimed.push(item);
    }
    return claimed;
  }

  async function markOutboxSent(id: string): Promise<void> {
    await prisma.telegramOutbox.updateMany({ where: { id, sentAt: null }, data: { sentAt: now() } });
  }

  async function markOutboxFailed(id: string): Promise<void> {
    await prisma.telegramOutbox.updateMany({ where: { id }, data: { attempts: { increment: 1 } } });
  }

  return {
    createLinkCode,
    confirmFromBot,
    unlink,
    purgeExpired,
    claimOutbox,
    markOutboxSent,
    markOutboxFailed,
  };
}

export type TelegramService = ReturnType<typeof createTelegramService>;
