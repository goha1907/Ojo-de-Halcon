import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PASSWORD, adultProfile, makeCore, prisma, resetDb } from "../../test/helpers";

beforeEach(resetDb);
afterAll(async () => {
  await prisma.$disconnect();
});

async function register(core = makeCore()) {
  const reg = await core.accounts.register({ email: "a@b.co", password: PASSWORD });
  if (!reg.ok) throw new Error("registration failed");
  return { core, userId: reg.userId };
}

describe("sessions", () => {
  it("returns the user, expires and can be destroyed", async () => {
    let current = new Date("2026-01-01T00:00:00Z");
    const core = makeCore({ now: () => current });
    const { userId } = await register(core);
    const session = await core.sessions.create(userId);

    expect(await core.sessions.getUser(session.token)).toMatchObject({
      id: userId,
      email: "a@b.co",
      emailVerified: true,
      profileComplete: false,
      telegramLinked: false,
      onboardingDone: false,
    });

    current = new Date("2026-03-01T00:00:00Z");
    expect(await core.sessions.getUser(session.token)).toBeNull();
    expect(await core.sessions.purgeExpired()).toBe(1);

    current = new Date("2026-01-02T00:00:00Z");
    const again = await core.sessions.create(userId);
    await core.sessions.destroy(again.token);
    expect(await core.sessions.getUser(again.token)).toBeNull();
    expect(await core.sessions.getUser(undefined)).toBeNull();
  });
});

describe("profile", () => {
  it("fills the profile, audits changes and flags completeness", async () => {
    const { core, userId } = await register();
    expect(await core.profile.update(userId, adultProfile)).toEqual({ allowed: true });

    const session = await core.sessions.create(userId);
    expect(await core.sessions.getUser(session.token)).toMatchObject({
      firstName: "Egor",
      lastName: "Medvedev",
      birthDate: "1987-07-19",
      profileComplete: true,
    });

    await core.profile.update(userId, { ...adultProfile, firstName: "Yegor", birthDate: new Date("1987-07-20T00:00:00Z") });
    const changes = await prisma.profileChange.findMany({ where: { userId }, orderBy: [{ createdAt: "asc" }, { field: "asc" }] });
    expect(changes.map((c) => [c.field, c.oldValue, c.newValue])).toEqual([
      ["birthDate", "", "1987-07-19"],
      ["firstName", "", "Egor"],
      ["lastName", "", "Medvedev"],
      ["pjnJurisdiction", "", "4"],
      ["birthDate", "1987-07-19", "1987-07-20"],
      ["firstName", "Egor", "Yegor"],
    ]);
  });

  it("accepts a profile without birth date or court", async () => {
    const { core, userId } = await register();
    await core.profile.update(userId, { ...adultProfile, birthDate: null, pjnJurisdiction: "" });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect([user.firstName, user.birthDate, user.pjnJurisdiction]).toEqual(["Egor", null, null]);
    // nothing but the name was recorded, and the name alone makes the profile complete
    expect((await prisma.profileChange.findMany()).map((c) => c.field).sort()).toEqual(["firstName", "lastName"]);
    expect((await core.sessions.getUser((await core.sessions.create(userId)).token))?.profileComplete).toBe(true);
  });

  it("writes nothing when nothing changed and marks onboarding once", async () => {
    const { core, userId } = await register();
    await core.profile.update(userId, adultProfile);
    const before = await prisma.profileChange.count();
    await core.profile.update(userId, adultProfile);
    expect(await prisma.profileChange.count()).toBe(before);

    await core.profile.completeOnboarding(userId);
    const first = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).onboardingCompletedAt;
    expect(first).not.toBeNull();
    await core.profile.completeOnboarding(userId);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).onboardingCompletedAt).toEqual(first);
  });
});
