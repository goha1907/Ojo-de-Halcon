import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../crypto";
import { PASSWORD, makeCore, makeMailbox, prisma, resetDb, tokenFromMail } from "../../test/helpers";

beforeEach(resetDb);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("password hashing", () => {
  it("verifies the right password only and salts every hash", async () => {
    const a = await hashPassword("secret-123");
    const b = await hashPassword("secret-123");
    expect(a).not.toBe(b);
    expect(await verifyPassword("secret-123", a)).toBe(true);
    expect(await verifyPassword("secret-124", a)).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });
});

describe("registration and login", () => {
  it("creates a verified account when verification is switched off", async () => {
    const { sent, mailer } = makeMailbox();
    const core = makeCore({ mailer });
    const result = await core.accounts.register({ email: " Egor@Example.com ", password: PASSWORD });
    expect(result.ok).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "egor@example.com" } });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.passwordHash).not.toContain(PASSWORD);
    expect(sent).toHaveLength(0);
  });

  it("rejects a duplicate e-mail regardless of case", async () => {
    const core = makeCore();
    await core.accounts.register({ email: "a@b.co", password: PASSWORD });
    expect(await core.accounts.register({ email: "A@B.CO", password: PASSWORD })).toEqual({
      ok: false,
      reason: "EMAIL_TAKEN",
    });
    expect(await prisma.user.count()).toBe(1);
  });

  it("logs in with the right password and refuses everything else", async () => {
    const core = makeCore();
    await core.accounts.register({ email: "a@b.co", password: PASSWORD });
    expect(await core.accounts.login({ email: "A@b.co", password: PASSWORD })).toMatchObject({ ok: true });
    expect(await core.accounts.login({ email: "a@b.co", password: "wrong" })).toEqual({ ok: false });
    expect(await core.accounts.login({ email: "nobody@b.co", password: PASSWORD })).toEqual({ ok: false });
  });
});

describe("e-mail verification (switched on)", () => {
  it("sends a link, verifies once and rejects reuse", async () => {
    const { sent, mailer } = makeMailbox();
    const core = makeCore({ mailer, verification: true });
    await core.accounts.register({ email: "a@b.co", password: PASSWORD });

    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("a@b.co");
    expect(sent[0]!.text).toContain("http://test.local/verify-email?token=");
    expect((await prisma.user.findUniqueOrThrow({ where: { email: "a@b.co" } })).emailVerifiedAt).toBeNull();

    const token = tokenFromMail(sent[0]!);
    expect(await core.accounts.verifyEmail(token)).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { email: "a@b.co" } })).emailVerifiedAt).not.toBeNull();
    expect(await core.accounts.verifyEmail(token)).toBe(false);
    expect(await core.accounts.verifyEmail("garbage")).toBe(false);
  });

  it("expires verification links", async () => {
    let current = new Date("2026-01-01T00:00:00Z");
    const { sent, mailer } = makeMailbox();
    const core = makeCore({ mailer, verification: true, now: () => current });
    await core.accounts.register({ email: "a@b.co", password: PASSWORD });
    current = new Date("2026-01-04T00:00:00Z"); // TTL is 48 hours
    expect(await core.accounts.verifyEmail(tokenFromMail(sent[0]!))).toBe(false);
  });

  it("keeps only the newest link valid after a resend", async () => {
    const { sent, mailer } = makeMailbox();
    const core = makeCore({ mailer, verification: true });
    const reg = await core.accounts.register({ email: "a@b.co", password: PASSWORD });
    if (!reg.ok) throw new Error("registration failed");
    await core.accounts.sendVerificationEmail(reg.userId);
    expect(sent).toHaveLength(2);
    expect(await core.accounts.verifyEmail(tokenFromMail(sent[0]!))).toBe(false);
    expect(await core.accounts.verifyEmail(tokenFromMail(sent[1]!))).toBe(true);
  });
});

describe("password reset", () => {
  it("changes the password, ends sessions and cannot be replayed", async () => {
    const { sent, mailer } = makeMailbox();
    const core = makeCore({ mailer });
    const reg = await core.accounts.register({ email: "a@b.co", password: PASSWORD });
    if (!reg.ok) throw new Error("registration failed");
    const session = await core.sessions.create(reg.userId);

    await core.accounts.requestPasswordReset("A@B.co");
    expect(sent).toHaveLength(1);
    const token = tokenFromMail(sent[0]!);

    expect(await core.accounts.resetPassword(token, "brand new password")).toBe(true);
    expect(await core.accounts.login({ email: "a@b.co", password: PASSWORD })).toEqual({ ok: false });
    expect(await core.accounts.login({ email: "a@b.co", password: "brand new password" })).toMatchObject({ ok: true });
    expect(await core.sessions.getUser(session.token)).toBeNull();
    expect(await core.accounts.resetPassword(token, "another password")).toBe(false);
  });

  it("stays silent for unknown addresses", async () => {
    const { sent, mailer } = makeMailbox();
    const core = makeCore({ mailer });
    await core.accounts.requestPasswordReset("nobody@b.co");
    expect(sent).toHaveLength(0);
  });

  it("does not accept a verification token as a reset token", async () => {
    const { sent, mailer } = makeMailbox();
    const core = makeCore({ mailer, verification: true });
    await core.accounts.register({ email: "a@b.co", password: PASSWORD });
    expect(await core.accounts.resetPassword(tokenFromMail(sent[0]!), "brand new password")).toBe(false);
  });
});

describe("account deletion", () => {
  it("requires the password and removes everything", async () => {
    const core = makeCore();
    const reg = await core.accounts.register({ email: "a@b.co", password: PASSWORD });
    if (!reg.ok) throw new Error("registration failed");
    await core.sessions.create(reg.userId);
    await core.telegram.createLinkCode(reg.userId);

    expect(await core.accounts.deleteAccount(reg.userId, "wrong")).toEqual({ ok: false });
    expect(await prisma.user.count()).toBe(1);

    expect(await core.accounts.deleteAccount(reg.userId, PASSWORD)).toEqual({ ok: true });
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
    expect(await prisma.telegramLinkCode.count()).toBe(0);
  });

  it("queues a farewell message for a linked Telegram chat", async () => {
    const core = makeCore();
    const reg = await core.accounts.register({ email: "t@b.co", password: PASSWORD });
    if (!reg.ok) throw new Error("registration failed");
    const { code } = await core.telegram.createLinkCode(reg.userId);
    await core.telegram.confirmFromBot({ code, telegram: { id: 77 } });

    await core.accounts.deleteAccount(reg.userId, PASSWORD);
    const outbox = await core.telegram.claimOutbox();
    expect(outbox.map((item) => [item.kind, item.telegramId, item.locale])).toEqual([
      ["account_deleted", 77n, "ru"],
    ]);
  });
});

describe("one account per mailbox and a remembered trial", () => {
  it("treats address variations of one mailbox as taken", async () => {
    const core = makeCore();
    expect((await core.accounts.register({ email: "e.gor@gmail.com", password: PASSWORD })).ok).toBe(true);
    expect(await core.accounts.register({ email: "egor+2@googlemail.com", password: PASSWORD })).toEqual({
      ok: false,
      reason: "EMAIL_TAKEN",
    });
  });

  it("starts the trial at registration and keeps it after the account is deleted and re-created", async () => {
    const before = Date.now();
    const core = makeCore();
    const first = await core.accounts.register({ email: "again@example.com", password: PASSWORD });
    if (!first.ok) throw new Error("registration failed");
    const started = (await prisma.user.findUniqueOrThrow({ where: { id: first.userId } })).trialStartedAt;
    // no tracker was added, the trial still runs from registration
    expect(started.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect((await core.access.get(first.userId)).plan).toBe("trial");

    await core.accounts.deleteAccount(first.userId, PASSWORD);
    const second = await core.accounts.register({ email: "AGAIN@example.com", password: PASSWORD });
    if (!second.ok) throw new Error("registration failed");
    const row = await prisma.user.findUniqueOrThrow({ where: { id: second.userId } });
    expect(row.trialStartedAt.getTime()).toBe(started.getTime());
  });
});
