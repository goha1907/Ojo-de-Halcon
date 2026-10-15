import { beforeEach, describe, expect, it } from "vitest";
import { PASSWORD, adultProfile, makeCore, prisma, resetDb } from "../../test/helpers";

beforeEach(resetDb);

async function account(email: string, core: ReturnType<typeof makeCore>) {
  const reg = await core.accounts.register({ email, password: PASSWORD });
  if (!reg.ok) throw new Error("registration failed");
  await core.profile.update(reg.userId, adultProfile);
  return reg.userId;
}

describe("capacity", () => {
  it("answers the same in TypeScript and in the polling query, for every kind of account", async () => {
    const core = makeCore();
    const trialOnly = await account("a@example.com", core);
    const giftAndPaid = await account("b@example.com", core);
    const nothing = await account("c@example.com", core);
    await core.grants.give({ userId: giftAndPaid, kind: "GIFT", cases: 2 });
    await core.billing.checkout(giftAndPaid, 3);
    await core.grants.revoke((await core.grants.list(nothing))[0]!.id);

    const numbers = ["100000001", "100000002", "100000003", "100000004", "100000005", "100000006"];
    for (const userId of [trialOnly, giftAndPaid, nothing]) {
      // places are not checked here: the cases are written straight into the table
      for (const reference of numbers) {
        await prisma.tracker.create({ data: { userId, kind: "RENAPER", reference, nextCheckAt: new Date(0) } });
      }
    }

    const covered = await core.capacity.coveredDueIds(100);
    const byUser = new Map<string, number>();
    const owners = await prisma.tracker.findMany({ where: { id: { in: covered } }, select: { userId: true } });
    for (const row of owners) byUser.set(row.userId, (byUser.get(row.userId) ?? 0) + 1);

    for (const userId of [trialOnly, giftAndPaid, nothing]) {
      const places = await core.capacity.get(userId);
      expect(byUser.get(userId) ?? 0).toBe(Math.min(places.total, numbers.length));
    }
    expect((await core.capacity.get(trialOnly)).total).toBe(1);
    expect((await core.capacity.get(giftAndPaid)).total).toBe(5);
    expect((await core.capacity.get(nothing)).total).toBe(0);
  });

  it("splits the places into paid, trial and gift", async () => {
    const core = makeCore();
    const userId = await account("a@example.com", core);
    expect(await core.capacity.get(userId)).toMatchObject({ paid: 0, trial: 1, gift: 0, total: 1, running: false });
    await core.grants.give({ userId, kind: "GIFT", cases: 4 });
    expect(await core.capacity.get(userId)).toMatchObject({ trial: 0, gift: 4, granted: 4, total: 4 });
    await core.billing.checkout(userId, 2);
    expect(await core.capacity.get(userId)).toMatchObject({ paid: 2, gift: 4, total: 6, running: true });
  });
});
