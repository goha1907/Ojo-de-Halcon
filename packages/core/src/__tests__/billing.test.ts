import { PRICING, casesPrice, quotePurchase } from "@ojo/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { adultProfile, makeCore, prisma, resetDb } from "../../test/helpers";

const DAY = 86_400_000;
const NOW = new Date("2026-10-14T12:00:00Z");

describe("casesPrice", () => {
  it("follows the ladder and adds a flat amount per case beyond it", () => {
    expect([1, 2, 3, 4, 5, 6].map(casesPrice)).toEqual([5000, 9000, 12000, 14000, 15000, 16000]);
    expect(casesPrice(100)).toBe(14000 + 96 * PRICING.extraCase);
    expect(casesPrice(0)).toBe(0);
  });
});

describe("quotePurchase", () => {
  it("charges a full period for the target when nothing is running", () => {
    const quote = quotePurchase({ subscriptionUntil: null, paidCases: 0, targetCases: 5, now: NOW });
    expect(quote).toMatchObject({ mode: "new_period", amount: 15000, casesAfter: 5, addCases: 5 });
    expect(quote.periodEnd.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it("charges added cases in full inside a running period and keeps its end", () => {
    const until = new Date(NOW.getTime() + 3 * DAY);
    const quote = quotePurchase({ subscriptionUntil: until, paidCases: 5, targetCases: 10, now: NOW });
    expect(quote).toMatchObject({ mode: "extra", amount: 5000, addCases: 5, casesAfter: 10 });
    expect(quote.periodEnd).toEqual(until);
  });

  it("starts a new period when the old one has ended", () => {
    const ended = new Date(NOW.getTime() - DAY);
    expect(quotePurchase({ subscriptionUntil: ended, paidCases: 2, targetCases: 2, now: NOW })).toMatchObject({
      mode: "new_period",
      amount: casesPrice(2),
    });
  });
});

describe("billing service", () => {
  beforeEach(resetDb);

  async function account() {
    const core = makeCore();
    const registered = await core.accounts.register({ email: "pay@example.com", password: "password-123" });
    if (!registered.ok) throw new Error("register failed");
    await core.profile.update(registered.userId, adultProfile);
    return { core, userId: registered.userId };
  }

  it("starts a period and records the payment with its time", async () => {
    const { core, userId } = await account();
    const result = await core.billing.checkout(userId, 5);
    expect(result).toMatchObject({ ok: true, quote: { mode: "new_period", amount: 15000 } });
    expect((await core.access.get(userId)).plan).toBe("subscription");
    expect(await core.billing.state(userId)).toMatchObject({
      paidCases: 5,
      // buying a subscription ended the trial place
      grantedCases: 0,
      freeCases: 5,
      currentPrice: 15000,
    });
    const [payment] = await core.billing.history(userId);
    expect(payment).toMatchObject({ kind: "subscription", amount: 15000, casesDelta: 5 });
    expect(Number.isNaN(Date.parse(payment!.createdAt))).toBe(false);
  });

  it("does not move the renewal date or charge anything when no case is added", async () => {
    const { core, userId } = await account();
    await core.billing.checkout(userId, 2);
    const before = (await core.access.get(userId)).until;
    expect(await core.billing.checkout(userId, 2)).toMatchObject({ ok: true, quote: { addCases: 0 } });
    expect((await core.access.get(userId)).until).toBe(before);
    expect(await core.billing.history(userId)).toHaveLength(1);
  });

  it("rejects a non-positive number of cases", async () => {
    const { core, userId } = await account();
    expect(await core.billing.checkout(userId, 0)).toEqual({ ok: false, reason: "INVALID_CASES" });
  });

  it("refuses to mark cases without a running subscription", async () => {
    const { core, userId } = await account();
    const added = await core.trackers.addTramite(userId, "RENAPER", "755824304");
    if (!added.ok) throw new Error("add failed");
    expect(await core.billing.setKept(userId, added.tracker.id, false)).toEqual({
      ok: false,
      reason: "SUBSCRIPTION_REQUIRED",
    });
  });
});

describe("feedback", () => {
  beforeEach(resetDb);

  it("stores a message with its context and drops the honeypot", async () => {
    const core = makeCore();
    const base = { topic: "technical" as const, name: null, email: "a@example.com", message: "Не приходит уведомление" };
    await core.feedback.submit({ ...base, website: "" }, { userId: null, locale: "ru" });
    await core.feedback.submit({ ...base, website: "http://spam" }, { userId: null, locale: "ru" });
    const rows = await prisma.feedbackMessage.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ topic: "technical", status: "NEW", locale: "ru", userId: null });
  });
});
