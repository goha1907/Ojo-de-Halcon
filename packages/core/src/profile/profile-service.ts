import type { PrismaClient } from "@ojo/db";
import type { ProfileInput } from "@ojo/shared";

export type ProfileEditDecision = { allowed: true } | { allowed: false; reason: "LOCKED" };

export function createProfileService(deps: { prisma: PrismaClient; now: () => Date }) {
  const { prisma, now } = deps;

  /**
   * Single place that decides whether a user may edit identity fields.
   * Policy is intentionally open for now (no tracked cases exist yet). Once
   * trackers are attached, this is where they lock the profile.
   */
  async function canEdit(_userId: string): Promise<ProfileEditDecision> {
    return { allowed: true };
  }

  async function update(userId: string, input: ProfileInput): Promise<ProfileEditDecision> {
    const decision = await canEdit(userId);
    if (!decision.allowed) return decision;

    const current = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const changes: { field: string; oldValue: string; newValue: string }[] = [];
    const diff = (field: string, oldValue: string | null, newValue: string) => {
      if ((oldValue ?? "") !== newValue) changes.push({ field, oldValue: oldValue ?? "", newValue });
    };
    diff("firstName", current.firstName, input.firstName);
    diff("lastName", current.lastName, input.lastName);
    diff("pjnJurisdiction", current.pjnJurisdiction, input.pjnJurisdiction);
    diff(
      "birthDate",
      current.birthDate ? current.birthDate.toISOString().slice(0, 10) : null,
      input.birthDate ? input.birthDate.toISOString().slice(0, 10) : "",
    );

    if (changes.length === 0) return { allowed: true };
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          firstName: input.firstName || null,
          lastName: input.lastName || null,
          birthDate: input.birthDate,
          pjnJurisdiction: input.pjnJurisdiction || null,
        },
      }),
      prisma.profileChange.createMany({ data: changes.map((change) => ({ userId, ...change })) }),
    ]);
    return { allowed: true };
  }

  /** Marks the post-registration onboarding as finished (or skipped). */
  async function completeOnboarding(userId: string): Promise<void> {
    await prisma.user.updateMany({
      where: { id: userId, onboardingCompletedAt: null },
      data: { onboardingCompletedAt: now() },
    });
  }

  /** The interface language of the account: the e-mails and the bot speak it too. */
  async function setLocale(userId: string, locale: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { locale } });
  }

  return { canEdit, update, completeOnboarding, setLocale };
}

export type ProfileService = ReturnType<typeof createProfileService>;
