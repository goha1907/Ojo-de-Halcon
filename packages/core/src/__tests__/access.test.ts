import { beforeEach, describe, expect, it } from "vitest";
import { resolveAccess } from "../index";
import { adultProfile, makeCore, prisma, resetDb } from "../../test/helpers";

const DAY = 86_400_000;

describe("resolveAccess", () => {
  const now = new Date("2026-10-14T12:00:00Z");

  it("reads the plan from the stored dates", () => {
    expect(resolveAccess({ trialStartedAt: null, subscriptionUntil: null }, now).plan).toBe("none");
    expect(resolveAccess({ trialStartedAt: new Date(now.getTime() - 2 * DAY), subscriptionUntil: null }, now).plan).toBe("trial");
    expect(resolveAccess({ trialStartedAt: new Date(now.getTime() - 8 * DAY), subscriptionUntil: null }, now)).toMatchObject({
      plan: "trial_expired",
      active: false,
    });
    expect(
      resolveAccess({ trialStartedAt: null, subscriptionUntil: new Date(now.getTime() + DAY) }, now).plan,
    ).toBe("subscription");
  });
});

describe("payment stub", () => {
  beforeEach(resetDb);

  async function user() {
    const core = makeCore();
    const registered = await core.accounts.register({ email: "stub@example.com", password: "password-123" });
    if (!registered.ok) throw new Error("register failed");
    await core.profile.update(registered.userId, adultProfile);
    return { core, userId: registered.userId };
  }

  it("grants, extends and cancels a subscription", async () => {
    const { core, userId } = await user();
    const first = await core.access.stub(userId, "activate");
    expect(first.plan).toBe("subscription");
    const second = await core.access.stub(userId, "activate");
    expect(new Date(second.until!).getTime()).toBeGreaterThan(new Date(first.until!).getTime());
    expect((await core.access.stub(userId, "cancel")).plan).toBe("none");
  });

  it("unlocks relatives and extra cases, and resets the trial", async () => {
    const { core, userId } = await user();
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    const person = {
      firstName: "Ana",
      lastName: "Perez",
      birthDate: new Date("2015-05-01T00:00:00Z"),
      pjnJurisdiction: "",
    };
    expect(await core.people.add(userId, person)).toMatchObject({ ok: false });
    await core.access.stub(userId, "activate");
    expect(await core.people.add(userId, person)).toMatchObject({ ok: true });

    await core.access.stub(userId, "cancel");
    await prisma.tracker.deleteMany({ where: { userId } });
    expect((await core.access.stub(userId, "resetTrial")).plan).toBe("none");
  });
});
