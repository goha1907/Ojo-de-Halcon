import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PASSWORD, makeCore, prisma, resetDb } from "../../test/helpers";

beforeEach(resetDb);
afterAll(async () => {
  await prisma.$disconnect();
});

async function user(email: string, core = makeCore()) {
  const reg = await core.accounts.register({ email, password: PASSWORD });
  if (!reg.ok) throw new Error("registration failed");
  return reg.userId;
}

describe("telegram linking", () => {
  it("binds the Telegram account to the code owner once", async () => {
    const core = makeCore();
    const userId = await user("a@b.co", core);
    const { code } = await core.telegram.createLinkCode(userId);

    const result = await core.telegram.confirmFromBot({ code, telegram: { id: 555, username: "egor" } });
    expect(result).toMatchObject({ ok: true, userId });

    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(row.telegramId).toBe(555n);
    expect(row.telegramUsername).toBe("egor");
    expect(row.telegramLinkedAt).not.toBeNull();

    // the code is single-use
    expect(await core.telegram.confirmFromBot({ code, telegram: { id: 555 } })).toEqual({
      ok: false,
      reason: "UNKNOWN_CODE",
    });
  });

  it("refuses a Telegram account that belongs to another user", async () => {
    const core = makeCore();
    const first = await user("a@b.co", core);
    const second = await user("c@d.co", core);
    const code1 = await core.telegram.createLinkCode(first);
    await core.telegram.confirmFromBot({ code: code1.code, telegram: { id: 777 } });

    const code2 = await core.telegram.createLinkCode(second);
    expect(await core.telegram.confirmFromBot({ code: code2.code, telegram: { id: 777 } })).toEqual({
      ok: false,
      reason: "ALREADY_LINKED",
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: second } })).telegramId).toBeNull();
  });

  it("expires codes and replaces the previous one", async () => {
    let current = new Date("2026-01-01T10:00:00Z");
    const core = makeCore({ now: () => current });
    const userId = await user("a@b.co", core);

    const old = await core.telegram.createLinkCode(userId);
    const fresh = await core.telegram.createLinkCode(userId);
    expect(await core.telegram.confirmFromBot({ code: old.code, telegram: { id: 1 } })).toEqual({
      ok: false,
      reason: "UNKNOWN_CODE",
    });

    current = new Date("2026-01-01T10:11:00Z"); // TTL is 10 minutes
    expect(await core.telegram.confirmFromBot({ code: fresh.code, telegram: { id: 1 } })).toEqual({
      ok: false,
      reason: "EXPIRED",
    });
  });

  it("lets only one of two concurrent deliveries win", async () => {
    const core = makeCore();
    const userId = await user("a@b.co", core);
    const { code } = await core.telegram.createLinkCode(userId);
    const results = await Promise.all([
      core.telegram.confirmFromBot({ code, telegram: { id: 9 } }),
      core.telegram.confirmFromBot({ code, telegram: { id: 9 } }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("unlinks", async () => {
    const core = makeCore();
    const userId = await user("a@b.co", core);
    const { code } = await core.telegram.createLinkCode(userId);
    await core.telegram.confirmFromBot({ code, telegram: { id: 5, username: "x" } });
    await core.telegram.unlink(userId);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect([row.telegramId, row.telegramUsername, row.telegramLinkedAt]).toEqual([null, null, null]);

    const outbox = await core.telegram.claimOutbox();
    expect(outbox.map((item) => [item.kind, item.telegramId])).toEqual([["unlinked", 5n]]);
  });

  it("queues one farewell even when unlink is requested twice at once", async () => {
    const core = makeCore();
    const userId = await user("g@h.co", core);
    const { code } = await core.telegram.createLinkCode(userId);
    await core.telegram.confirmFromBot({ code, telegram: { id: 8 } });
    await Promise.all([core.telegram.unlink(userId), core.telegram.unlink(userId)]);
    expect(await prisma.telegramOutbox.count()).toBe(1);
  });

  it("hands a message to one worker only", async () => {
    const core = makeCore();
    const userId = await user("i@j.co", core);
    const { code } = await core.telegram.createLinkCode(userId);
    await core.telegram.confirmFromBot({ code, telegram: { id: 9 } });
    await core.telegram.unlink(userId);
    const [a, b] = await Promise.all([core.telegram.claimOutbox(), core.telegram.claimOutbox()]);
    expect(a.length + b.length).toBe(1);
  });

  it("does not queue a message when nothing was linked", async () => {
    const core = makeCore();
    const userId = await user("c@d.co", core);
    await core.telegram.unlink(userId);
    expect(await core.telegram.claimOutbox()).toHaveLength(0);
  });

  it("retries a failed outbox message a limited number of times", async () => {
    const core = makeCore();
    const userId = await user("e@f.co", core);
    const { code } = await core.telegram.createLinkCode(userId);
    await core.telegram.confirmFromBot({ code, telegram: { id: 6 } });
    await core.telegram.unlink(userId);
    const [item] = await core.telegram.claimOutbox();
    for (let i = 0; i < 5; i += 1) await core.telegram.markOutboxFailed(item!.id);
    expect(await core.telegram.claimOutbox()).toHaveLength(0);
  });
});
