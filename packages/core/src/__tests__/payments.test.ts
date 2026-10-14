import { beforeEach, describe, expect, it } from "vitest";
import { adultProfile, makeCore, prisma, resetDb } from "../../test/helpers";

const START = new Date("2026-10-14T12:00:00Z");
const after = (seconds: number) => new Date(START.getTime() + seconds * 1000);

async function account(now: () => Date) {
  const core = makeCore({ now });
  const registered = await core.accounts.register({ email: "pay@example.com", password: "password-123" });
  if (!registered.ok) throw new Error("register failed");
  await core.profile.update(registered.userId, adultProfile);
  return { core, userId: registered.userId };
}

describe("payments: checkout with a provider", () => {
  beforeEach(resetDb);

  it("pays by QR: nothing is granted until the provider says it was paid, then once", async () => {
    let clock = START;
    const { core, userId } = await account(() => clock);
    expect(core.payments.methods()).toEqual(["mercadopago_qr", "card"]);

    const created = await core.payments.create(userId, { cases: 3, method: "mercadopago_qr" });
    if (!created.ok) throw new Error("create failed");
    expect(created.intent).toMatchObject({ status: "PENDING", amount: 12000, targetCases: 3 });
    expect(created.intent.qrPayload).toContain("ojo-stub://");
    expect((await core.billing.state(userId)).paidCases).toBe(0);

    clock = after(2);
    expect(await core.payments.get(userId, created.intent.id)).toMatchObject({ status: "PENDING" });
    expect((await core.billing.state(userId)).paidCases).toBe(0);

    clock = after(10);
    expect(await core.payments.get(userId, created.intent.id)).toMatchObject({ status: "SUCCEEDED" });
    expect(await core.payments.get(userId, created.intent.id)).toMatchObject({ status: "SUCCEEDED" });
    expect((await core.billing.state(userId)).paidCases).toBe(3);

    // one purchase, recorded with the way it was paid
    const [payment] = await core.billing.history(userId);
    expect(payment).toMatchObject({ amount: 12000, kind: "subscription", casesDelta: 3 });
    expect(await prisma.payment.findMany()).toHaveLength(1);
    expect((await prisma.payment.findFirstOrThrow()).method).toBe("mercadopago_qr");
  });

  it("pays by card with a token: processing, then success; a declined card fails and grants nothing", async () => {
    let clock = START;
    const { core, userId } = await account(() => clock);

    const ok = await core.payments.create(userId, { cases: 1, method: "card" });
    if (!ok.ok) throw new Error("create failed");
    expect((await core.payments.submitCard(userId, ok.intent.id, "stub_tok_ok_1"))?.status).toBe("PROCESSING");
    clock = after(10);
    expect((await core.payments.get(userId, ok.intent.id))?.status).toBe("SUCCEEDED");
    expect((await core.billing.state(userId)).paidCases).toBe(1);

    // buying more later goes the same way and is charged as an addition
    const more = await core.payments.create(userId, { cases: 2, method: "card" });
    if (!more.ok) throw new Error("create failed");
    expect(more.intent.amount).toBe(4000);
    await core.payments.submitCard(userId, more.intent.id, "stub_tok_declined_2");
    clock = after(30);
    expect(await core.payments.get(userId, more.intent.id)).toMatchObject({
      status: "FAILED",
      failureReason: "card_declined",
    });
    expect((await core.billing.state(userId)).paidCases).toBe(1);
  });

  it("expires an unpaid checkout, can be cancelled, and keeps one open checkout at a time", async () => {
    let clock = START;
    const { core, userId } = await account(() => clock);
    const first = await core.payments.create(userId, { cases: 1, method: "mercadopago_qr" });
    const second = await core.payments.create(userId, { cases: 2, method: "card" });
    if (!first.ok || !second.ok) throw new Error("create failed");
    expect((await core.payments.get(userId, first.intent.id))?.status).toBe("CANCELLED");

    expect((await core.payments.cancel(userId, second.intent.id))?.status).toBe("CANCELLED");
    const third = await core.payments.create(userId, { cases: 1, method: "card" });
    if (!third.ok) throw new Error("create failed");
    clock = new Date(START.getTime() + 16 * 60_000);
    expect((await core.payments.get(userId, third.intent.id))?.status).toBe("EXPIRED");
    expect((await core.billing.state(userId)).paidCases).toBe(0);
  });

  it("only the owner can see or change a checkout, and a bad request is refused", async () => {
    const { core, userId } = await account(() => START);
    const other = await core.accounts.register({ email: "other@example.com", password: "password-123" });
    if (!other.ok) throw new Error("register failed");
    const created = await core.payments.create(userId, { cases: 1, method: "card" });
    if (!created.ok) throw new Error("create failed");
    expect(await core.payments.get(other.userId, created.intent.id)).toBeNull();
    expect(await core.payments.cancel(other.userId, created.intent.id)).toBeNull();

    expect(await core.payments.create(userId, { cases: 0, method: "card" })).toEqual({ ok: false, reason: "INVALID_CASES" });
    expect(await core.payments.create(userId, { cases: 1, method: "paypal" })).toEqual({
      ok: false,
      reason: "METHOD_UNAVAILABLE",
    });
    expect(await core.payments.create(userId, { cases: 999, method: "card" })).toEqual({
      ok: false,
      reason: "LIMIT_REACHED",
    });
  });
});
