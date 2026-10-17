import { casesPrice } from "@ojo/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { PASSWORD, adultProfile, makeCore, prisma, resetDb } from "../../test/helpers";

const DAY = 86_400_000;

beforeEach(resetDb);

async function setup(clock: { at: Date }) {
  const core = makeCore({ now: () => clock.at });
  const reg = await core.accounts.register({ email: "helper@example.com", password: PASSWORD });
  if (!reg.ok) throw new Error("registration failed");
  await core.profile.update(reg.userId, adultProfile);
  return { core, userId: reg.userId };
}

const NUMBERS = ["100000001", "100000002", "100000003", "100000004", "100000005"];

describe("free places", () => {
  it("gives every account a trial with an explicit end date", async () => {
    const clock = { at: new Date("2026-10-14T10:00:00Z") };
    const { core, userId } = await setup(clock);
    const [trial] = await core.grants.list(userId);
    expect(trial).toMatchObject({ kind: "TRIAL", cases: 1, active: true });
    expect(new Date(trial!.expiresAt!).getTime()).toBe(clock.at.getTime() + 7 * DAY);
    expect(await core.access.get(userId)).toMatchObject({ plan: "granted", grantedCases: 1 });
  });

  it("moves a case from the trial place to the bonus places without cost", async () => {
    const clock = { at: new Date("2026-10-14T10:00:00Z") };
    const { core, userId } = await setup(clock);
    await core.trackers.addTramite(userId, "RENAPER", NUMBERS[0]!);
    // the trial place is the only one: a second case needs a subscription
    expect(await core.trackers.addTramite(userId, "RENAPER", NUMBERS[1]!)).toMatchObject({
      ok: false,
      reason: "SUBSCRIPTION_REQUIRED",
    });

    // 5 places for 30 days; the trial runs out meanwhile
    await core.grants.give({
      userId,
      kind: "BONUS",
      cases: 5,
      expiresAt: new Date(clock.at.getTime() + 30 * DAY),
      grantedBy: "admin",
    });
    clock.at = new Date(clock.at.getTime() + 8 * DAY);
    const state = await core.billing.state(userId);
    expect(state).toMatchObject({ paidCases: 0, grantedCases: 5, activeCases: 1, freeCases: 4, currentPrice: 0 });
    for (const number of NUMBERS.slice(1, 5)) {
      expect(await core.trackers.addTramite(userId, "RENAPER", number)).toMatchObject({ ok: true });
    }
    expect(await core.trackers.addTramite(userId, "CORREO", "999999")).toMatchObject({
      ok: false,
      reason: "SUBSCRIPTION_REQUIRED",
    });
  });

  it("stops the cases when the bonus ends, tells the owner once, and resumes after buying", async () => {
    const clock = { at: new Date("2026-10-14T10:00:00Z") };
    const { core, userId } = await setup(clock);
    await prisma.user.update({ where: { id: userId }, data: { telegramId: 4242n } });
    await core.grants.give({
      userId,
      kind: "GIFT",
      cases: 5,
      expiresAt: new Date(clock.at.getTime() + 30 * DAY),
    });
    for (const number of NUMBERS) await core.trackers.addTramite(userId, "RENAPER", number);
    expect(await core.trackers.runDue(10)).toBe(5);

    clock.at = new Date(clock.at.getTime() + 31 * DAY);
    await prisma.tracker.updateMany({ where: { userId }, data: { nextCheckAt: clock.at } });
    expect(await core.trackers.runDue(10)).toBe(0);
    expect(await core.access.get(userId)).toMatchObject({ plan: "none", active: false });

    // one message, with the number of stopped cases
    const outbox = await prisma.telegramOutbox.findMany();
    expect(outbox.map((item) => [item.kind, item.telegramId, item.payload])).toEqual([
      ["free_places_ended", 4242n, { count: "5" }],
    ]);
    await core.trackers.runDue(10);
    expect(await prisma.telegramOutbox.count()).toBe(1);

    // buying places brings them back by themselves, nothing was deleted
    await core.billing.checkout(userId, 5);
    expect(await prisma.tracker.count({ where: { userId, status: "ACTIVE" } })).toBe(5);
    expect(await core.trackers.runDue(10)).toBe(5);
  });

  it("covers the oldest cases first when only some places remain", async () => {
    const clock = { at: new Date("2026-10-14T10:00:00Z") };
    const { core, userId } = await setup(clock);
    await core.grants.give({ userId, kind: "BONUS", cases: 3, expiresAt: new Date(clock.at.getTime() + 10 * DAY) });
    for (const number of NUMBERS.slice(0, 3)) await core.trackers.addTramite(userId, "RENAPER", number);
    // a subscription of 3 places is bought as well (the 3 cases it must hold are the bonus ones)
    expect(await core.billing.checkout(userId, 3)).toMatchObject({ ok: true });
    for (const number of NUMBERS.slice(3, 5)) await core.trackers.addTramite(userId, "RENAPER", number);

    clock.at = new Date(clock.at.getTime() + 11 * DAY);
    await prisma.tracker.updateMany({ where: { userId }, data: { nextCheckAt: clock.at } });
    // 3 paid places remain: the three oldest cases are checked
    expect(await core.trackers.runDue(10)).toBe(3);
    const checked = await prisma.tracker.findMany({ where: { userId, nextCheckAt: { gt: clock.at } } });
    expect(checked.map((item) => item.reference).sort()).toEqual(NUMBERS.slice(0, 3).sort());
  });

  it("ends the trial place when a subscription is bought", async () => {
    const clock = { at: new Date("2026-10-14T10:00:00Z") };
    const { core, userId } = await setup(clock);
    await core.trackers.addTramite(userId, "RENAPER", NUMBERS[0]!);
    expect(await core.access.get(userId)).toMatchObject({ plan: "granted", trialCases: 1, giftCases: 0 });

    // the case sits on the trial place; buying a subscription moves it to the paid one
    expect(await core.billing.checkout(userId, 1)).toMatchObject({ ok: true });
    expect(await core.access.get(userId)).toMatchObject({ plan: "subscription", trialCases: 0 });
    expect(await core.billing.state(userId)).toMatchObject({
      paidCases: 1,
      grantedCases: 0,
      activeCases: 1,
      freeCases: 0,
      nextPeriodCases: 1,
    });
    // the trial just ends: nobody is told that places ran out
    expect(await prisma.telegramOutbox.count()).toBe(0);
  });

  it("ends the trial place when places are given", async () => {
    const clock = { at: new Date("2026-10-14T10:00:00Z") };
    const { core, userId } = await setup(clock);
    await core.trackers.addTramite(userId, "RENAPER", NUMBERS[0]!);
    await core.grants.give({ userId, kind: "GIFT", cases: 5, expiresAt: new Date(clock.at.getTime() + 30 * DAY) });
    expect(await core.access.get(userId)).toMatchObject({ plan: "granted", trialCases: 0, giftCases: 5 });
    // the case stays, now on a gift place: 4 are left
    expect(await core.billing.state(userId)).toMatchObject({
      activeCases: 1,
      grantedCases: 5,
      freeCases: 4,
      // free places take the case first, the paid ones hold none
      grantedUsedCases: 1,
      paidUsedCases: 0,
    });
    expect(await core.grants.give({ userId, kind: "GIFT", cases: 1 }).then(() => true)).toBe(true);
    await expect(core.grants.give({ userId, kind: "TRIAL", cases: 1 })).rejects.toThrow();
    expect(await prisma.telegramOutbox.count()).toBe(0);
  });

  it("lets an end date be set or a grant taken back", async () => {
    const clock = { at: new Date("2026-10-14T10:00:00Z") };
    const { core, userId } = await setup(clock);
    const grant = await core.grants.give({ userId, kind: "ADMIN", cases: 2 });
    expect(await core.grants.setExpiry(grant.id, new Date(clock.at.getTime() + DAY))).toBe(true);
    expect((await core.capacity.get(userId)).granted).toBe(2);
    clock.at = new Date(clock.at.getTime() + 2 * DAY);
    expect((await core.capacity.get(userId)).granted).toBe(0);
    const other = await core.grants.give({ userId, kind: "BONUS", cases: 4 });
    expect((await core.capacity.get(userId)).granted).toBe(4);
    expect(await core.grants.revoke(other.id)).toBe(true);
    expect((await core.capacity.get(userId)).granted).toBe(0);
  });

  it("shows the nearest end of the bonus places and how many places end then, and moves on to the next end", async () => {
    const clock = { at: new Date("2026-10-14T10:00:00Z") };
    const { core, userId } = await setup(clock);
    const day = (n: number) => new Date(Date.UTC(2026, 9, 14 + n, 23, 59, 59));
    // two grants end on the same day, one later, one never; the trial does not count as a gift
    await core.grants.give({ userId, kind: "GIFT", cases: 2, expiresAt: day(5) });
    await core.grants.give({ userId, kind: "BONUS", cases: 1, expiresAt: day(5) });
    await core.grants.give({ userId, kind: "PROMO", cases: 4, expiresAt: day(20) });
    await core.grants.give({ userId, kind: "ADMIN", cases: 3 });
    let access = await core.access.get(userId);
    expect(access.giftCases).toBe(10);
    expect(access.giftNextEnd).toEqual({ until: day(5).toISOString(), cases: 3 });

    // the day passes: the numbers are recalculated and point to the next end
    clock.at = new Date(Date.UTC(2026, 9, 20, 12));
    access = await core.access.get(userId);
    expect(access.giftCases).toBe(7);
    expect(access.giftNextEnd).toEqual({ until: day(20).toISOString(), cases: 4 });

    // only endless gifts are left: nothing to announce
    clock.at = new Date(Date.UTC(2026, 10, 10, 12));
    access = await core.access.get(userId);
    expect(access.giftCases).toBe(3);
    expect(access.giftNextEnd).toBeNull();
  });

  it("explains a case on a gift place that will need a paid place after the gift ends", async () => {
    const clock = { at: new Date("2026-10-14T10:00:00Z") };
    const { core, userId } = await setup(clock);
    // a gift that ends before the subscription period does, one case on it, five paid places bought
    await core.grants.give({ userId, kind: "GIFT", cases: 1, expiresAt: new Date(clock.at.getTime() + 10 * DAY) });
    await core.trackers.addTramite(userId, "RENAPER", NUMBERS[0]!);
    expect(await core.billing.checkout(userId, 5)).toMatchObject({ ok: true });

    const state = await core.billing.state(userId);
    expect(state).toMatchObject({
      paidCases: 5,
      paidUsedCases: 0,
      grantedUsedCases: 1,
      // the five paid places are empty today, but the case needs one of them once the gift is over
      unusedCases: 5,
      incomingCases: 1,
      leavesMarked: 0,
      nextPeriodCases: 1,
    });
    // the rows explain the figure: paid - empty + incoming = next
    expect(state.paidCases - state.unusedCases - state.freedByFinished + state.incomingCases).toBe(
      state.nextPeriodCases,
    );
  });

  it("charges the next period only for the cases the free places do not cover", async () => {
    const clock = { at: new Date("2026-10-14T10:00:00Z") };
    const { core, userId } = await setup(clock);
    await core.grants.give({ userId, kind: "BONUS", cases: 2 });
    await prisma.freeGrant.updateMany({ where: { userId, kind: "TRIAL" }, data: { revokedAt: clock.at } });
    await core.billing.checkout(userId, 3);
    for (const number of NUMBERS) await core.trackers.addTramite(userId, "RENAPER", number);
    // 5 cases, 2 free places and 3 paid ones: the paid ones are all used and all stay
    expect(await core.billing.state(userId)).toMatchObject({
      activeCases: 5,
      freeCases: 0,
      nextPeriodCases: 3,
      nextPeriodPrice: casesPrice(3),
    });

    // one case marked: the free places still cover it, so only 2 paid places are needed
    const [first] = await core.trackers.list(userId);
    await core.billing.setKept(userId, first!.id, false);
    expect(await core.billing.state(userId)).toMatchObject({
      nextPeriodCases: 2,
      nextPeriodPrice: casesPrice(2),
      leavesMarked: 1,
    });
  });
});
