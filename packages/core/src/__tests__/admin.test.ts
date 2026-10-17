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

describe("admin: bonus places", () => {
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

describe("admin: early access", () => {
  it("turns the flag on and off for an account, audited", async () => {
    const { core, actor, customerId } = await setup();
    expect((await core.admin.setEarlyAccess(actor, customerId, true)).ok).toBe(true);
    expect((await core.sessions.getUser((await core.sessions.create(customerId)).token))?.earlyAccess).toBe(true);
    expect((await core.admin.setEarlyAccess(actor, customerId, true)).ok).toBe(true);
    expect((await core.admin.setEarlyAccess(actor, customerId, false)).ok).toBe(true);
    expect((await core.admin.auditLog({})).items.map((item) => item.action)).toEqual(["user.earlyAccess", "user.earlyAccess"]);
    expect(await core.admin.setEarlyAccess(actor, "missing", true)).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("gives staff early access without the flag", async () => {
    const { core, actor } = await setup();
    const session = await core.sessions.create(actor.id);
    expect(await core.sessions.getUser(session.token)).toMatchObject({ role: "ADMIN", earlyAccess: true });
  });
});


describe("news", () => {
  const post = (title: string) => ({ title, summary: "s", body: "text" });

  it("saves all languages at once, updates them and removes an emptied language", async () => {
    const { core, actor } = await setup();
    const slug = "2026-10-17-hello";
    const saved = await core.admin.saveNews(actor, {
      slug,
      time: "09:30",
      translations: { ru: post("Привет"), es: post("Hola"), en: post("Hello") },
    });
    expect(saved.ok).toBe(true);
    expect((await core.admin.listNews())[0]).toMatchObject({ slug, date: "2026-10-17", time: "09:30" });
    expect(Object.keys((await core.admin.listNews())[0]!.translations).sort()).toEqual(["en", "es", "ru"]);

    await core.admin.saveNews(actor, { slug, time: "09:30", translations: { ru: post("Привет!"), es: post(" ") } });
    const [entry] = await core.admin.listNews();
    expect(entry!.translations.ru!.title).toBe("Привет!");
    expect(Object.keys(entry!.translations)).toEqual(["ru"]);
    expect(await prisma.auditLog.count({ where: { action: "news.save" } })).toBe(2);
  });

  it("requires the default language and a well-formed slug and time", async () => {
    const { core, actor } = await setup();
    const only = { es: post("Hola") };
    expect(await core.admin.saveNews(actor, { slug: "2026-10-17-x", time: "09:30", translations: only })).toEqual({ ok: false, reason: "INVALID" });
    expect(await core.admin.saveNews(actor, { slug: "bad slug", time: "09:30", translations: { ru: post("a") } })).toEqual({ ok: false, reason: "INVALID" });
    expect(await core.admin.saveNews(actor, { slug: "2026-10-17-x", time: "25:00", translations: { ru: post("a") } })).toEqual({ ok: false, reason: "INVALID" });
    expect(await core.admin.saveNews(actor, { slug: "2026-13-45-x", time: "10:00", translations: { ru: post("a") } })).toEqual({ ok: false, reason: "INVALID" });
  });

  it("keeps a single main news and moves the mark to the one saved last", async () => {
    const { core, actor } = await setup();
    const save = (slug: string, featured?: boolean) =>
      core.admin.saveNews(actor, { slug, time: "10:00", translations: { ru: post("a"), en: post("b") }, ...(featured === undefined ? {} : { featured }) });
    await save("2026-10-17-first", true);
    await save("2026-10-17-second");
    expect((await core.admin.listNews()).filter((entry) => entry.featured).map((entry) => entry.slug)).toEqual(["2026-10-17-first"]);

    await save("2026-10-17-second", true);
    expect((await core.admin.listNews()).filter((entry) => entry.featured).map((entry) => entry.slug)).toEqual(["2026-10-17-second"]);
    // every language of the entry carries the mark
    expect(await prisma.newsPost.count({ where: { slug: "2026-10-17-second", featured: true } })).toBe(2);

    await save("2026-10-17-second", false);
    expect((await core.admin.listNews()).some((entry) => entry.featured)).toBe(false);
  });

  it("stores a cover only from public/news and leaves it alone when not sent", async () => {
    const { core, actor } = await setup();
    const slug = "2026-10-17-cover";
    const base = { slug, time: "10:00", translations: { ru: post("a") } };
    expect((await core.admin.saveNews(actor, { ...base, image: "/news/cabinet.svg" })).ok).toBe(true);
    expect((await core.admin.listNews())[0]!.image).toBe("/news/cabinet.svg");
    await core.admin.saveNews(actor, base);
    expect((await core.admin.listNews())[0]!.image).toBe("/news/cabinet.svg");
    expect(await core.admin.saveNews(actor, { ...base, image: "https://example.com/a.png" })).toEqual({ ok: false, reason: "INVALID" });
    await core.admin.saveNews(actor, { ...base, image: null });
    expect((await core.admin.listNews())[0]!.image).toBeNull();
  });

  it("stores an uploaded cover in the database and serves it back", async () => {
    const { core, actor } = await setup();
    const url = await core.admin.saveNewsImage(actor, { mime: "image/webp", data: new Uint8Array([1, 2, 3, 4]) });
    expect(url).toMatch(/^\/api\/news\/image\/[a-z0-9]+$/);
    const found = await core.admin.newsImage(url.split("/").pop()!);
    expect(found?.mime).toBe("image/webp");
    expect([...found!.data]).toEqual([1, 2, 3, 4]);
    expect(await core.admin.newsImage("nope")).toBeNull();
    expect(await core.admin.newsImage("../etc")).toBeNull();
    // an entry may point to it, and to nothing else outside public/news
    const base = { slug: "2026-10-17-up", time: "10:00", translations: { ru: post("a") } };
    expect((await core.admin.saveNews(actor, { ...base, image: url })).ok).toBe(true);
    expect((await core.admin.listNews())[0]!.image).toBe(url);
    expect(await core.admin.saveNews(actor, { ...base, image: "/api/other/1" })).toEqual({ ok: false, reason: "INVALID" });
    expect(await prisma.auditLog.count({ where: { action: "news.image" } })).toBe(1);
  });

  it("deletes an entry with all its languages", async () => {
    const { core, actor } = await setup();
    await core.admin.saveNews(actor, { slug: "2026-10-17-gone", time: "00:00", translations: { ru: post("a"), en: post("b") } });
    expect((await core.admin.deleteNews(actor, "2026-10-17-gone")).ok).toBe(true);
    expect(await core.admin.listNews()).toHaveLength(0);
    expect(await core.admin.deleteNews(actor, "2026-10-17-gone")).toEqual({ ok: false, reason: "NOT_FOUND" });
  });
});

describe("subscription tools", () => {
  it("renews and resets a subscription with audit entries", async () => {
    const { core, actor, customerId } = await setup();
    await core.billing.checkout(customerId, 1);
    await prisma.tracker.create({ data: { userId: customerId, kind: "RENAPER", reference: "755824304", nextCheckAt: new Date() } });
    expect((await core.admin.renewSubscription(actor, customerId)).ok).toBe(true);
    expect((await core.admin.resetSubscription(actor, customerId)).ok).toBe(true);
    expect((await core.access.get(customerId)).plan).toBe("none");
    expect(await prisma.auditLog.count({ where: { action: { in: ["subscription.renew", "subscription.reset"] } } })).toBe(2);
    expect(await core.admin.resetSubscription(actor, "missing")).toEqual({ ok: false, reason: "NOT_FOUND" });
  });
});

describe("inbox reading and replies", () => {
  it("marks a message read when opened and answered when replied", async () => {
    const { core, actor } = await setup();
    await core.feedback.submit(
      { topic: "technical", name: null, email: "a@example.com", message: "Hello there, help", website: "" },
      { userId: null, locale: "ru" },
    );
    const [message] = (await core.admin.listFeedback({ status: "NEW" })).items;
    const opened = await core.admin.openFeedback(actor, message!.id);
    expect(opened).toMatchObject({ status: "READ", reply: null });
    expect((await core.admin.listFeedback({ status: "NEW" })).total).toBe(0);

    expect(await core.admin.replyFeedback(actor, message!.id, "  ")).toEqual({ ok: false, reason: "INVALID" });
    expect((await core.admin.replyFeedback(actor, message!.id, "We are on it")).ok).toBe(true);
    expect(await core.admin.openFeedback(actor, message!.id)).toMatchObject({ status: "ANSWERED", reply: "We are on it", repliedBy: "boss@example.com" });
    expect(await core.admin.replyFeedback(actor, "missing", "x")).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(await core.admin.openFeedback(actor, "missing")).toBeNull();
  });
});

describe("admin lists", () => {
  async function seed() {
    const base = await setup();
    const { core, actor, customerId } = base;
    const second = await core.accounts.register({ email: "second@example.com", password: PASSWORD });
    if (!second.ok) throw new Error("registration failed");
    await core.admin.giveGrant(actor, { userId: customerId, kind: "GIFT", cases: 3, expiresAt: null });
    await core.billing.checkout(second.userId, 2);
    await prisma.tracker.create({ data: { userId: customerId, kind: "RENAPER", reference: "755824304", nextCheckAt: new Date() } });
    return { ...base, secondId: second.userId };
  }

  it("filters users by plan, bonus places and cases", async () => {
    const { core, customerId, secondId } = await seed();
    const ids = async (query: Record<string, string>) => (await core.admin.listUsers(query)).items.map((row) => row.id);
    expect(await ids({ plan: "subscription" })).toEqual([secondId]);
    expect(await ids({ gift: "yes" })).toEqual([customerId]);
    expect(await ids({ plan: "gift" })).toEqual([customerId]);
    expect(await ids({ cases: "active" })).toEqual([customerId]);
    expect(await ids({ role: "ADMIN" })).toHaveLength(1);
    expect(await ids({ query: "SECOND" })).toEqual([secondId]);
    expect(await ids({ telegram: "yes" })).toEqual([]);
  });

  it("shows bonus places and agrees with the capacity of each account", async () => {
    const { core, customerId, secondId } = await seed();
    const rows = (await core.admin.listUsers({})).items;
    for (const row of rows) expect(row.places).toBe((await core.capacity.get(row.id)).total);
    expect(rows.find((row) => row.id === customerId)).toMatchObject({ gift: 3, cases: 1, plan: "gift" });
    expect(rows.find((row) => row.id === secondId)).toMatchObject({ gift: 0, plan: "subscription" });
  });

  it("sorts users by a computed column in both directions and pages the result", async () => {
    const { core, customerId } = await seed();
    const up = (await core.admin.listUsers({ sort: "gift", dir: "asc" })).items.map((row) => row.gift);
    const down = (await core.admin.listUsers({ sort: "gift", dir: "desc" })).items.map((row) => row.gift);
    expect(up).toEqual([...up].sort((a, b) => a - b));
    expect(down).toEqual([...up].reverse());
    const page = await core.admin.listUsers({ sort: "gift", dir: "desc", pageSize: 1, page: 1 });
    expect(page).toMatchObject({ total: 3, pageSize: 1 });
    expect(page.items[0]!.id).toBe(customerId);
    // an unknown sort column falls back to the default
    expect((await core.admin.listUsers({ sort: "password" })).total).toBe(3);
  });

  it("filters and sorts payments and the audit log of one account", async () => {
    const { core, actor, secondId } = await seed();
    await core.billing.renew(secondId).catch(() => undefined);
    await prisma.payment.create({ data: { userId: secondId, amount: 10, currency: "ARS", kind: "cases", provider: "mercadopago", receiptUrl: "https://example.com/r/1" } });
    const all = await core.admin.userPayments(secondId, {});
    expect(all.total).toBeGreaterThanOrEqual(2);
    expect(all.providers).toContain("mercadopago");
    const real = await core.admin.userPayments(secondId, { provider: "mercadopago" });
    expect(real.items).toHaveLength(1);
    expect(real.items[0]!.receiptUrl).toBe("https://example.com/r/1");
    const cheapest = await core.admin.userPayments(secondId, { sort: "amount", dir: "asc" });
    expect(cheapest.items[0]!.amount).toBe(10);
    expect((await core.admin.userPayments(secondId, { from: "2999-01-01" })).total).toBe(0);

    await core.admin.giveGrant(actor, { userId: secondId, kind: "GIFT", cases: 1, expiresAt: null });
    const log = await core.admin.auditLog({ userId: secondId });
    expect(log.actions).toContain("grant.give");
    expect((await core.admin.auditLog({ query: "second@" })).total).toBe(log.total);
    expect((await core.admin.auditLog({ action: "no.such" })).total).toBe(0);
  });

  it("filters the inbox by text, topic and status", async () => {
    const { core } = await seed();
    await core.feedback.submit({ topic: "technical", name: "Ana", email: "ana@example.com", message: "It does not open", website: "" }, { userId: null, locale: "es" });
    await core.feedback.submit({ topic: "other", name: null, email: "bob@example.com", message: "Thanks a lot", website: "" }, { userId: null, locale: "en" });
    expect((await core.admin.listFeedback({ query: "does not" })).items).toHaveLength(1);
    expect((await core.admin.listFeedback({ topic: "other" })).items[0]!.email).toBe("bob@example.com");
    expect((await core.admin.listFeedback({ locale: "es" })).total).toBe(1);
    expect((await core.admin.listFeedback({ sort: "email", dir: "asc" })).items[0]!.email).toBe("ana@example.com");
    expect((await core.admin.listFeedback({ status: "ANSWERED" })).total).toBe(0);
  });

  it("reports the money for the owner", async () => {
    const { core, secondId } = await seed();
    const figures = await core.admin.economics();
    expect(figures).toMatchObject({ running: 1, paidPlaces: 2, giftPlaces: 3 });
    expect(figures.estimatedMonthly).toBeGreaterThan(0);
    expect(figures.byKind.length).toBeGreaterThan(0);
    expect(secondId).toBeTruthy();
  });
});
