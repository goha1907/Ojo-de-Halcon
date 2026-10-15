import { beforeEach, describe, expect, it } from "vitest";
import { resolveAccess } from "../index";
import { adultProfile, makeCore, prisma, resetDb } from "../../test/helpers";

const DAY = 86_400_000;

describe("resolveAccess", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const none = { trial: 0, gift: 0, until: null, lastEnd: null };

  it("reads the plan from the paid period and the free places", () => {
    // free places active: the trial, a bonus, a gift
    expect(resolveAccess({ subscriptionUntil: null }, { trial: 1, gift: 0, until: new Date(now.getTime() + DAY), lastEnd: null }, now))
      .toMatchObject({ plan: "granted", active: true, grantedCases: 1 });
    // free places with no end date keep going
    expect(resolveAccess({ subscriptionUntil: null }, { trial: 0, gift: 5, until: null, lastEnd: null }, now)).toMatchObject({
      plan: "granted",
      until: null,
    });
    expect(resolveAccess({ subscriptionUntil: null }, { ...none, lastEnd: new Date(now.getTime() - DAY) }, now)).toMatchObject({
      plan: "none",
      active: false,
    });
    expect(resolveAccess({ subscriptionUntil: new Date(now.getTime() + DAY) }, none, now).plan).toBe("subscription");
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
    // buying the subscription ended the trial place, so nothing is left after cancelling it
    expect((await core.access.stub(userId, "cancel")).plan).toBe("none");
    await core.trackers.addTramite(userId, "RENAPER", "755824304");
    await prisma.tracker.deleteMany({ where: { userId } });
    expect((await core.access.stub(userId, "resetTrial")).plan).toBe("granted");
  });
});
