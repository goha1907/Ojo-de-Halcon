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
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { telegramId: null, telegramUsername: null, telegramLinkedAt: null },
      }),
      prisma.telegramLinkCode.deleteMany({ where: { userId } }),
    ]);
  }

  async function purgeExpired(): Promise<number> {
    const result = await prisma.telegramLinkCode.deleteMany({ where: { expiresAt: { lt: now() } } });
    return result.count;
  }

  return { createLinkCode, confirmFromBot, unlink, purgeExpired };
}

export type TelegramService = ReturnType<typeof createTelegramService>;
