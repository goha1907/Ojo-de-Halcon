import { beforeEach, describe, expect, it } from "vitest";
import { PASSWORD, adultProfile, makeCore, prisma, resetDb } from "../../test/helpers";

beforeEach(resetDb);

async function setup() {
  const core = makeCore();
  const operator = await core.accounts.createOperator({ email: "boss@example.com", password: PASSWORD, role: "ADMIN" });
  const customerReg = await core.accounts.register({ email: "client@example.com", password: PASSWORD });
  if (!customerReg.ok) throw new Error("registration failed");
  await core.profile.update(customerReg.userId, adultProfile);
  return {
    core,
    actor: { id: operator.userId, email: "boss@example.com" },
    customerId: customerReg.userId,
  };
}

describe("operators", () => {
  it("creates a verified staff account without a trial place and can log in", async () => {
    const { core, actor } = await setup();
    expect(await core.accounts.login({ email: "boss@example.com", password: PASSWORD })).toMatchObject({ ok: true });
    const session = await core.sessions.create(actor.id);
    expect(await core.sessions.getUser(session.token)).toMatchObject({ role: "ADMIN", emailVerified: true });
    expect(await core.grants.list(actor.id)).toHaveLength(0);
  });

  it("promotes an existing account and keeps its password unless told to reset it", async () => {
    const { core, customerId } = await setup();
    const promoted = await core.accounts.createOperator({ email: "CLIENT@example.com", password: "other-password-1", role: "SUPPORT" });
    expect(promoted).toEqual({ userId: customerId, created: false });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customerId } })).role).toBe("SUPPORT");
    expect((await core.accounts.login({ email: "client@example.com", password: PASSWORD })).ok).toBe(true);
    await core.accounts.createOperator({ email: "client@example.com", password: "other-password-1", role: "SUPPORT", resetPassword: true });
    expect((await core.accounts.login({ email: "client@example.com", password: PASSWORD })).ok).toBe(false);
    expect((await core.accounts.login({ email: "client@example.com", password: "other-password-1" })).ok).toBe(true);
  });

  it("keeps customers at the USER role", async () => {
    const { core, customerId } = await setup();
    const session = await core.sessions.create(customerId);
    expect(await core.sessions.getUser(session.token)).toMatchObject({ role: "USER" });
  });
});

describe("admin: gift places", () => {
  it("gives places, records who did it, and ends the trial", async () => {
    const { core, actor, customerId } = await setup();
    const result = await core.admin.giveGrant(actor, {
      userId: customerId,
      kind: "GIFT",
      cases: 5,
      expiresAt: new Date(Date.now() + 30 * 86_400_000),
      note: "helper",
      requestId: "form-1",
    });
    expect(result.ok).toBe(true);
    expect(await core.access.get(customerId)).toMatchObject({ giftCases: 5, trialCases: 0 });
    const audit = await core.admin.auditLog({});
    expect(audit.items[0]).toMatchObject({ actorEmail: "boss@example.com", action: "grant.give", targetEmail: "client@example.com" });
    const [grant] = await core.grants.list(customerId);
    expect(grant).toMatchObject({ kind: "GIFT", cases: 5, note: "helper" });
  });

  it("acts once when the same form is sent twice", async () => {
    const { core, actor, customerId } = await setup();
    const input = { userId: customerId, kind: "GIFT", cases: 3, expiresAt: null, requestId: "same-form" };
    expect((await core.admin.giveGrant(actor, input)).ok).toBe(true);
    expect(await core.admin.giveGrant(actor, input)).toEqual({ ok: false, reason: "DUPLICATE" });
    expect((await core.capacity.get(customerId)).gift).toBe(3);
  });

  it("rejects nonsense and unknown accounts", async () => {
    const { core, actor, customerId } = await setup();
    const bad = (patch: object) =>
      core.admin.giveGrant(actor, { userId: customerId, kind: "GIFT", cases: 1, expiresAt: null, ...patch });
    expect(await bad({ cases: 0 })).toEqual({ ok: false, reason: "INVALID" });
    expect(await bad({ cases: 1000 })).toEqual({ ok: false, reason: "INVALID" });
    expect(await bad({ kind: "TRIAL" })).toEqual({ ok: false, reason: "INVALID" });
    expect(await bad({ expiresAt: new Date(Date.now() - 1000) })).toEqual({ ok: false, reason: "INVALID" });
    expect(await bad({ userId: "missing" })).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("changes the end date and revokes a grant, both audited", async () => {
    const { core, actor, customerId } = await setup();
    const given = await core.admin.giveGrant(actor, { userId: customerId, kind: "GIFT", cases: 2, expiresAt: null });
    if (!given.ok) throw new Error("give failed");
    const end = new Date(Date.now() + 5 * 86_400_000);
    expect((await core.admin.setGrantExpiry(actor, given.value.grantId, end)).ok).toBe(true);
    expect((await core.grants.list(customerId))[0]!.expiresAt).toBe(end.toISOString());
    expect((await core.admin.revokeGrant(actor, given.value.grantId)).ok).toBe(true);
    expect((await core.capacity.get(customerId)).gift).toBe(0);
    expect(await core.admin.revokeGrant(actor, given.value.grantId)).toEqual({ ok: false, reason: "NOT_FOUND" });
    const actions = (await core.admin.auditLog({})).items.map((item) => item.action).reverse();
    expect(actions).toEqual(["grant.give", "grant.expiry", "grant.revoke"]);
  });
});

describe("admin: reading", () => {
  it("lists and searches accounts and shows one in detail", async () => {
    const { core, customerId } = await setup();
    const all = await core.admin.listUsers({});
    expect(all.total).toBe(2);
    const found = await core.admin.listUsers({ query: "CLIENT@" });
    expect(found.items.map((row) => row.email)).toEqual(["client@example.com"]);
    expect(found.items[0]).toMatchObject({ plan: "trial", places: 1, cases: 0 });

    const detail = await core.admin.userDetail(customerId);
    expect(detail).toMatchObject({ user: { email: "client@example.com", role: "USER" }, access: { plan: "granted" } });
    expect(await core.admin.userDetail("missing")).toBeNull();
  });

  it("summarises the service and the sources", async () => {
    const { core, actor, customerId } = await setup();
    await core.admin.giveGrant(actor, { userId: customerId, kind: "GIFT", cases: 2, expiresAt: null });
    await core.trackers.addTramite(customerId, "RENAPER", "755824304");
    await core.billing.checkout(customerId, 3);
    const overview = await core.admin.overview();
    expect(overview.users).toMatchObject({ total: 2, staff: 1 });
    expect(overview.subscriptions).toMatchObject({ running: 1, paidPlaces: 3 });
    expect(overview.subscriptions.estimatedMonthly).toBeGreaterThan(0);
    expect(overview.gifts).toEqual({ activePlaces: 2, accounts: 1 });
    expect(overview.trackers.active).toBe(1);
    const sources = await core.admin.sourcesHealth();
    expect(sources).toEqual([expect.objectContaining({ kind: "RENAPER", active: 1 })]);
  });

  it("moves inbox messages through their statuses", async () => {
    const { core, actor } = await setup();
    await core.feedback.submit(
      { topic: "technical", name: "Ana", email: "ana@example.com", message: "It does not open", website: "" },
      { userId: null, locale: "es" },
    );
    const [message] = (await core.admin.listFeedback({ status: "NEW" })).items;
    expect(message).toMatchObject({ email: "ana@example.com", status: "NEW" });
    expect((await core.admin.setFeedbackStatus(actor, message!.id, "ANSWERED")).ok).toBe(true);
    expect((await core.admin.listFeedback({ status: "NEW" })).total).toBe(0);
    expect(await core.admin.setFeedbackStatus(actor, message!.id, "NOPE")).toEqual({ ok: false, reason: "INVALID" });
  });
});
