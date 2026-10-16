import type { PrismaClient, User } from "@ojo/db";
import { keyedHash, randomToken } from "../crypto";
import type { CoreConfig, UserDto } from "../types";

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    firstName: user.firstName,
    lastName: user.lastName,
    birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
    pjnJurisdiction: user.pjnJurisdiction,
    profileComplete: Boolean(user.firstName && user.lastName),
    telegramLinked: user.telegramId !== null,
    telegramUsername: user.telegramUsername,
    locale: user.locale,
    onboardingDone: user.onboardingCompletedAt !== null,
    role: user.role,
    earlyAccess: user.earlyAccess || user.role !== "USER",
  };
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export function createSessionService(deps: {
  prisma: PrismaClient;
  config: CoreConfig;
  now: () => Date;
}) {
  const { prisma, config, now } = deps;

  async function create(userId: string): Promise<CreatedSession> {
    const token = randomToken(config.sessionTokenBytes);
    const expiresAt = new Date(now().getTime() + config.sessionTtlDays * 86_400_000);
    await prisma.session.create({
      data: { userId, tokenHash: keyedHash(config.secret, "session", token), expiresAt },
    });
    return { token, expiresAt };
  }

  async function getUser(token: string | undefined | null): Promise<UserDto | null> {
    if (!token) return null;
    const session = await prisma.session.findUnique({
      where: { tokenHash: keyedHash(config.secret, "session", token) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= now()) return null;
    return toUserDto(session.user);
  }

  async function destroy(token: string | undefined | null): Promise<void> {
    if (!token) return;
    await prisma.session.deleteMany({
      where: { tokenHash: keyedHash(config.secret, "session", token) },
    });
  }

  /** Signs the user out everywhere except the session of `keepToken`. */
  async function destroyOthers(userId: string, keepToken: string | undefined | null): Promise<void> {
    await prisma.session.deleteMany({
      where: {
        userId,
        ...(keepToken ? { tokenHash: { not: keyedHash(config.secret, "session", keepToken) } } : {}),
      },
    });
  }

  /** Housekeeping: drop expired sessions. */
  async function purgeExpired(): Promise<number> {
    const result = await prisma.session.deleteMany({ where: { expiresAt: { lt: now() } } });
    return result.count;
  }

  return { create, getUser, destroy, destroyOthers, purgeExpired };
}

export type SessionService = ReturnType<typeof createSessionService>;
