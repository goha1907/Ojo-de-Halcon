import type { PrismaClient } from "@ojo/db";
import { APP_CONFIG, type PersonInput } from "@ojo/shared";
import { resolveAccess } from "../access/access-service";

export interface PersonDto {
  id: string;
  firstName: string;
  lastName: string;
  /** ISO date `YYYY-MM-DD`. */
  birthDate: string;
  pjnJurisdiction: string | null;
}

export type PersonResult =
  | { ok: true; person: PersonDto }
  | { ok: false; reason: "LIMIT_REACHED" | "SUBSCRIPTION_REQUIRED" | "NOT_FOUND" };

function toDto(row: {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  pjnJurisdiction: string | null;
}): PersonDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    birthDate: row.birthDate.toISOString().slice(0, 10),
    pjnJurisdiction: row.pjnJurisdiction,
  };
}

export function createPeopleService(deps: { prisma: PrismaClient; now: () => Date }) {
  const { prisma, now } = deps;

  async function list(userId: string): Promise<PersonDto[]> {
    const rows = await prisma.person.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    return rows.map(toDto);
  }

  /**
   * Adds a relative. Once the free trial has started, more people need a
   * subscription (the trial covers exactly one case of the owner).
   */
  async function add(userId: string, input: PersonInput): Promise<PersonResult> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { trialStartedAt: true, subscriptionUntil: true },
    });
    const access = resolveAccess(user, now());
    if (access.plan === "trial" || access.plan === "trial_expired") {
      return { ok: false, reason: "SUBSCRIPTION_REQUIRED" };
    }
    const count = await prisma.person.count({ where: { userId } });
    if (count >= APP_CONFIG.limits.maxPeople) return { ok: false, reason: "LIMIT_REACHED" };
    const row = await prisma.person.create({
      data: {
        userId,
        firstName: input.firstName,
        lastName: input.lastName,
        birthDate: input.birthDate,
        pjnJurisdiction: input.pjnJurisdiction || null,
      },
    });
    return { ok: true, person: toDto(row) };
  }

  async function update(userId: string, personId: string, input: PersonInput): Promise<PersonResult> {
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

  /** Deletes the person together with their trackers (cascade). */
  async function remove(userId: string, personId: string): Promise<boolean> {
    const result = await prisma.person.deleteMany({ where: { id: personId, userId } });
    return result.count === 1;
  }

  return { list, add, update, remove };
}

export type PeopleService = ReturnType<typeof createPeopleService>;
