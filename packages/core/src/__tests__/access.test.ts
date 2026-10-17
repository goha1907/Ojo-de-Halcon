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

  it("resets a subscription and clears only the test payment log", async () => {
    const { core, userId } = await user();
    await core.billing.checkout(userId, 1);
    expect((await core.access.get(userId)).plan).toBe("subscription");
    await prisma.payment.create({
      data: { userId, amount: 5000, currency: "ARS", kind: "subscription", casesDelta: 1, provider: "mercadopago" },
    });
    // buying the subscription ended the trial place, so nothing is left after the reset
    expect((await core.access.resetSubscription(userId)).plan).toBe("none");
    // the test record is gone, the real one stays
    const left = await prisma.payment.findMany({ where: { userId } });
    expect(left.map((row) => row.provider)).toEqual(["mercadopago"]);
    expect(await core.billing.state(userId)).toMatchObject({ paidCases: 0 });
  });
});
