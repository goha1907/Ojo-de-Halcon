import type { PrismaClient } from "@ojo/db";
import { APP_CONFIG, type PersonInput } from "@ojo/shared";
import { resolveAccess } from "../access/access-service";

/** Person data as accepted by the service (`notifyTelegram` defaults to on). */
export type PersonDraft = Omit<PersonInput, "notifyTelegram"> & { notifyTelegram?: boolean };

export interface PersonDto {
  id: string;
  firstName: string;
  lastName: string;
  /** ISO date `YYYY-MM-DD`, when known. */
  birthDate: string | null;
  pjnJurisdiction: string | null;
  notifyTelegram: boolean;
}

export type PersonResult =
  | { ok: true; person: PersonDto }
  | { ok: false; reason: "LIMIT_REACHED" | "SUBSCRIPTION_REQUIRED" | "NOT_FOUND" | "FEATURE_DISABLED" };

function toDto(row: {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  pjnJurisdiction: string | null;
  notifyTelegram: boolean;
}): PersonDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    birthDate: row.birthDate ? row.birthDate.toISOString().slice(0, 10) : null,
    pjnJurisdiction: row.pjnJurisdiction,
    notifyTelegram: row.notifyTelegram,
  };
}

export function createPeopleService(deps: { prisma: PrismaClient; now: () => Date; enabled: boolean }) {
  const { prisma, now, enabled } = deps;

  async function list(userId: string): Promise<PersonDto[]> {
    // dormant feature: stored relatives are neither shown nor used
    if (!enabled) return [];
    const rows = await prisma.person.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    return rows.map(toDto);
  }

  /**
   * Adds a relative. Needs a running subscription; every case of the relative is
   * paid as any other case (billing), the person itself costs nothing.
   */
  async function add(userId: string, input: PersonDraft): Promise<PersonResult> {
    if (!enabled) return { ok: false, reason: "FEATURE_DISABLED" };
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { trialStartedAt: true, subscriptionUntil: true },
    });
    const access = resolveAccess(user, now());
    if (access.plan !== "subscription") return { ok: false, reason: "SUBSCRIPTION_REQUIRED" };
    const count = await prisma.person.count({ where: { userId } });
    if (count >= APP_CONFIG.limits.maxPeople) return { ok: false, reason: "LIMIT_REACHED" };
    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { telegramId: true, locale: true },
    });
    const row = await prisma.person.create({
      data: {
        userId,
        firstName: input.firstName,
        lastName: input.lastName,
        birthDate: input.birthDate,
        pjnJurisdiction: input.pjnJurisdiction || null,
        notifyTelegram: input.notifyTelegram ?? true,
      },
    });
    if (owner.telegramId !== null) {
      await prisma.telegramOutbox.create({
        data: {
          telegramId: owner.telegramId,
          kind: "person_added",
          locale: owner.locale,
          payload: { name: `${row.firstName} ${row.lastName}` },
        },
      });
    }
    return { ok: true, person: toDto(row) };
  }

  async function update(userId: string, personId: string, input: PersonDraft): Promise<PersonResult> {
    if (!enabled) return { ok: false, reason: "FEATURE_DISABLED" };
    const result = await prisma.person.updateMany({
      where: { id: personId, userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        birthDate: input.birthDate,
        pjnJurisdiction: input.pjnJurisdiction || null,
      },
    });
    if (result.count !== 1) return { ok: false, reason: "NOT_FOUND" };
    const row = await prisma.person.findUniqueOrThrow({ where: { id: personId } });
    return { ok: true, person: toDto(row) };
  }

  /** Switches Telegram updates for one relative on or off (any time, free). */
  async function setNotify(userId: string, personId: string, notifyTelegram: boolean): Promise<boolean> {
    if (!enabled) return false;
    const result = await prisma.person.updateMany({
      where: { id: personId, userId },
      data: { notifyTelegram },
    });
    if (result.count !== 1) return false;
    // the person's switch drives all their cases (each can still be changed on its own)
    await prisma.tracker.updateMany({ where: { userId, personId }, data: { notifyTelegram } });
    return true;
  }

  /**
   * Deletes the person together with their trackers (cascade). Support/admin
   * only: users cannot call this, as add/remove cycles would bypass the limits.
   */
  async function remove(userId: string, personId: string): Promise<boolean> {
    const person = await prisma.person.findFirst({ where: { id: personId, userId } });
    if (!person) return false;
    const result = await prisma.person.deleteMany({ where: { id: personId, userId } });
    if (result.count !== 1) return false;
    await announceRemoval(userId, [person]);
    return true;
  }

  /** Tells the owner's Telegram that relatives left the account. */
  async function announceRemoval(
    userId: string,
    removed: { firstName: string; lastName: string }[],
  ): Promise<void> {
    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true, locale: true },
    });
    if (!owner || owner.telegramId === null) return;
    for (const person of removed) {
      await prisma.telegramOutbox.create({
        data: {
          telegramId: owner.telegramId,
          kind: "person_removed",
          locale: owner.locale,
          payload: { name: `${person.firstName} ${person.lastName}` },
        },
      });
    }
  }

  return { list, add, update, setNotify, remove, announceRemoval };
}

export type PeopleService = ReturnType<typeof createPeopleService>;
