import { beforeEach, describe, expect, it } from "vitest";
import { resolveAccess } from "../index";
import { adultProfile, makeCore, prisma, resetDb } from "../../test/helpers";

const DAY = 86_400_000;

describe("resolveAccess", () => {
  const now = new Date("2026-10-14T12:00:00Z");

  it("reads the plan from the stored dates", () => {
    expect(resolveAccess({ trialStartedAt: now, subscriptionUntil: null }, now).plan).toBe("trial");
    expect(resolveAccess({ trialStartedAt: new Date(now.getTime() - 2 * DAY), subscriptionUntil: null }, now).plan).toBe("trial");
    expect(resolveAccess({ trialStartedAt: new Date(now.getTime() - 8 * DAY), subscriptionUntil: null }, now)).toMatchObject({
      plan: "trial_expired",
      active: false,
    });
    expect(
      resolveAccess({ trialStartedAt: now, subscriptionUntil: new Date(now.getTime() + DAY) }, now).plan,
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

  it("cancels a subscription and resets the trial", async () => {
    const { core, userId } = await user();
    await core.billing.checkout(userId, 1);
    expect((await core.access.get(userId)).plan).toBe("subscription");
    expect((await core.access.stub(userId, "cancel")).plan).toBe("trial");
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    await prisma.tracker.deleteMany({ where: { userId } });
    expect((await core.access.stub(userId, "resetTrial")).plan).toBe("trial");
  });
});
