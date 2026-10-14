import { PRICING, periodPrice, quoteCheckout } from "@ojo/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { adultProfile, makeCore, prisma, resetDb } from "../../test/helpers";

const DAY = 86_400_000;
const NOW = new Date("2026-10-14T12:00:00Z");

describe("quoteCheckout", () => {
  it("charges a full period for the owner and every seat when nothing is running", () => {
    const quote = quoteCheckout({ subscriptionUntil: null, seats: 0, addSeats: 2, now: NOW });
    expect(quote).toMatchObject({ mode: "new_period", amount: periodPrice(2), seatsAfter: 2 });
    expect(quote.periodEnd.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it("charges only the remaining days for seats added to a running period", () => {
    const until = new Date(NOW.getTime() + 15 * DAY);
    const quote = quoteCheckout({ subscriptionUntil: until, seats: 1, addSeats: 2, now: NOW });
    expect(quote.mode).toBe("prorated");
    expect(quote.amount).toBe(PRICING.perUserPerPeriod * 2 * 0.5);
    expect(quote.periodEnd).toEqual(until);
  });

  it("is never free for seats, even on the last day", () => {
    const until = new Date(NOW.getTime() + 1000);
    expect(quoteCheckout({ subscriptionUntil: until, seats: 0, addSeats: 1, now: NOW }).amount).toBeGreaterThanOrEqual(1);
  });

  it("renews seats too when the period has ended", () => {
    const ended = new Date(NOW.getTime() - DAY);
    const quote = quoteCheckout({ subscriptionUntil: ended, seats: 2, addSeats: 0, now: NOW });
    expect(quote).toMatchObject({ mode: "new_period", amount: periodPrice(2) });
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
  const person = (name: string) => ({
    firstName: name,
    lastName: "Perez",
    birthDate: new Date("2015-05-01T00:00:00Z"),
    pjnJurisdiction: "",
  });

  it("requires paid slots before a relative can be added", async () => {
    const { core, userId } = await account();
    expect(await core.people.add(userId, person("Ana"))).toEqual({ ok: false, reason: "SUBSCRIPTION_REQUIRED" });

    await core.billing.checkout(userId, 0); // the owner's own subscription
    expect(await core.people.add(userId, person("Ana"))).toEqual({ ok: false, reason: "SLOT_REQUIRED" });

    await core.billing.checkout(userId, 2);
    expect(await core.people.add(userId, person("Ana"))).toMatchObject({ ok: true });
    expect(await core.people.add(userId, person("Luis"))).toMatchObject({ ok: true });
    expect(await core.people.add(userId, person("Eva"))).toEqual({ ok: false, reason: "SLOT_REQUIRED" });
  });

  it("starts the period with the first purchase and keeps its end date for later seats", async () => {
    const { core, userId } = await account();
    const first = await core.billing.checkout(userId, 1);
    if (!first.ok) throw new Error("checkout failed");
    const second = await core.billing.checkout(userId, 1);
    if (!second.ok) throw new Error("checkout failed");
    expect(second.quote.mode).toBe("prorated");
    expect(second.quote.periodEnd).toBe(first.quote.periodEnd);
    const payments = await core.billing.history(userId);
    expect(payments.map((item) => [item.kind, item.seatsDelta])).toEqual([
      ["seats", 1],
      ["subscription", 1],
    ]);
  });

  it("refuses more slots than the account limit", async () => {
    const { core, userId } = await account();
    expect(await core.billing.checkout(userId, 6)).toEqual({ ok: false, reason: "LIMIT_REACHED" });
    expect(await core.billing.checkout(userId, -1)).toEqual({ ok: false, reason: "INVALID_SEATS" });
  });

  it("reduces slots only when the right number of people is chosen, and lowers the next price", async () => {
    const { core, userId } = await account();
    await core.billing.checkout(userId, 3);
    const ana = await core.people.add(userId, person("Ana"));
    const luis = await core.people.add(userId, person("Luis"));
    if (!ana.ok || !luis.ok) throw new Error("add failed");
    await core.trackers.addTramite(userId, "RENAPER", "755824304", ana.person.id);

    // two people, one slot left: exactly one must be removed
    expect(await core.billing.reduceSeats(userId, { seats: 1, removePersonIds: [] })).toEqual({
      ok: false,
      reason: "PEOPLE_MISMATCH",
    });
    expect(await core.billing.reduceSeats(userId, { seats: 1, removePersonIds: [ana.person.id, luis.person.id] })).toEqual({
      ok: false,
      reason: "PEOPLE_MISMATCH",
    });

    expect(await core.billing.reduceSeats(userId, { seats: 1, removePersonIds: [ana.person.id] })).toEqual({
      ok: true,
      seats: 1,
    });
    expect(await prisma.tracker.count({ where: { userId } })).toBe(0); // her cases went with her
    expect((await core.billing.state(userId)).nextPeriodPrice).toBe(periodPrice(1));

    // empty slots can be dropped without removing anyone
    expect(await core.billing.reduceSeats(userId, { seats: 1, removePersonIds: [] })).toMatchObject({ ok: true });
  });

  it("does not let one account remove another account's people", async () => {
    const { core, userId } = await account();
    const other = await core.accounts.register({ email: "other@example.com", password: "password-123" });
    if (!other.ok) throw new Error("register failed");
    await core.billing.checkout(other.userId, 1);
    const foreign = await core.people.add(other.userId, person("Zoe"));
    if (!foreign.ok) throw new Error("add failed");
    await core.billing.checkout(userId, 0);
    expect(await core.billing.reduceSeats(userId, { seats: 0, removePersonIds: [foreign.person.id] })).toEqual({
      ok: false,
      reason: "PEOPLE_MISMATCH",
    });
  });

  it("keeps the payment history after the account is deleted", async () => {
    const { core, userId } = await account();
    await core.billing.checkout(userId, 1);
    await prisma.user.delete({ where: { id: userId } });
    const rows = await prisma.payment.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBeNull();
  });
});
