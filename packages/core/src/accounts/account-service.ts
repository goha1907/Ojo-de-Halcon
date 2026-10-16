import type { EmailTokenType, PrismaClient } from "@ojo/db";
import { canonicalEmail, createTranslator, normalizeEmail, resolveLocale } from "@ojo/shared";
import { hashPassword, keyedHash, randomToken, verifyPassword } from "../crypto";
import type { Mailer } from "../mailer";
import { trialGrantData } from "../grants/grant-service";
import type { CoreConfig } from "../types";

export type RegisterResult = { ok: true; userId: string } | { ok: false; reason: "EMAIL_TAKEN" };
export type LoginResult = { ok: true; userId: string } | { ok: false };

/** Hash compared when the e-mail is unknown, so timing does not reveal accounts. */
const DUMMY_HASH =
  "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export function createAccountService(deps: {
  prisma: PrismaClient;
  config: CoreConfig;
  mailer: Mailer;
  now: () => Date;
}) {
  const { prisma, config, mailer, now } = deps;

  async function issueEmailToken(userId: string, type: EmailTokenType, ttlMs: number): Promise<string> {
    const token = randomToken(config.emailTokenBytes);
    // Only the newest link of a kind stays valid.
    await prisma.emailToken.deleteMany({ where: { userId, type, usedAt: null } });
    await prisma.emailToken.create({
      data: {
        userId,
        type,
        tokenHash: keyedHash(config.secret, "email", token),
        expiresAt: new Date(now().getTime() + ttlMs),
      },
    });
    return token;
  }

  async function consumeEmailToken(token: string, type: EmailTokenType): Promise<string | null> {
    const record = await prisma.emailToken.findUnique({
      where: { tokenHash: keyedHash(config.secret, "email", token) },
    });
    if (!record || record.type !== type || record.usedAt || record.expiresAt <= now()) return null;
    const claimed = await prisma.emailToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: now() },
    });
    return claimed.count === 1 ? record.userId : null;
  }

  async function sendVerificationEmail(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.emailVerifiedAt) return;
    const token = await issueEmailToken(userId, "VERIFY_EMAIL", config.verifyEmailTtlHours * 3_600_000);
    const t = createTranslator(resolveLocale(user.locale));
    const link = `${config.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await mailer.send({ to: user.email, subject: t("email.verify.subject"), text: t("email.verify.body", { link }) });
  }

  async function register(input: { email: string; password: string; locale?: string }): Promise<RegisterResult> {
    const email = normalizeEmail(input.email);
    const emailCanonical = canonicalEmail(email);
    const taken = await prisma.user.findFirst({
      where: { OR: [{ email }, { emailCanonical }] },
      select: { id: true },
    });
    if (taken) return { ok: false, reason: "EMAIL_TAKEN" };
    // A mailbox that already used its trial (even on a deleted account) keeps that start date.
    const ledgerHash = keyedHash(config.secret, "ledger", `email:${emailCanonical}`);
    const used = await prisma.trialLedger.findUnique({ where: { keyHash: ledgerHash } });
    const trialStartedAt = used?.trialStartedAt ?? now();
    const passwordHash = await hashPassword(input.password);
    try {
      const user = await prisma.user.create({
        data: {
          email,
          emailCanonical,
          passwordHash,
          locale: resolveLocale(input.locale),
          termsAcceptedAt: now(),
          // With verification switched off every new account counts as verified.
          emailVerifiedAt: config.emailVerificationRequired ? null : now(),
        },
      });
      // The trial is a free grant with an explicit end date.
      await prisma.freeGrant.create({ data: trialGrantData(user.id, trialStartedAt, now()) });
      // Remember the mailbox's trial so deleting the account does not restart it.
      await prisma.trialLedger.upsert({
        where: { keyHash: ledgerHash },
        create: { keyHash: ledgerHash, kind: "email", trialStartedAt },
        update: {},
      });
      if (config.emailVerificationRequired) await sendVerificationEmail(user.id);
      return { ok: true, userId: user.id };
    } catch (error) {
      if (isUniqueViolation(error)) return { ok: false, reason: "EMAIL_TAKEN" };
      throw error;
    }
  }

  async function login(input: { email: string; password: string }): Promise<LoginResult> {
    const user = await prisma.user.findUnique({ where: { email: normalizeEmail(input.email) } });
    const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
    return user && valid ? { ok: true, userId: user.id } : { ok: false };
  }

  /** Always resolves the same way, whether or not the address is registered. */
  async function requestPasswordReset(emailInput: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email: normalizeEmail(emailInput) } });
    if (!user) return;
    const token = await issueEmailToken(user.id, "RESET_PASSWORD", config.resetPasswordTtlMinutes * 60_000);
    const t = createTranslator(resolveLocale(user.locale));
    const link = `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await mailer.send({ to: user.email, subject: t("email.reset.subject"), text: t("email.reset.body", { link }) });
  }

  async function resetPassword(token: string, newPassword: string): Promise<boolean> {
    const userId = await consumeEmailToken(token, "RESET_PASSWORD");
    if (!userId) return false;
    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      // A reset link proves control of the mailbox, so it also verifies it.
      prisma.user.update({ where: { id: userId }, data: { passwordHash, emailVerifiedAt: now() } }),
      prisma.session.deleteMany({ where: { userId } }),
    ]);
    return true;
  }

  async function verifyEmail(token: string): Promise<boolean> {
    const userId = await consumeEmailToken(token, "VERIFY_EMAIL");
    if (!userId) return false;
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: now() } });
    return true;
  }

  /** Sets a new password after checking the current one. Other devices are signed out by the caller. */
  async function changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: boolean }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) return { ok: false };
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
    return { ok: true };
  }

  /**
   * Creates (or updates) a staff account: verified, no trial place, the given role. An existing account
   * keeps its password unless `resetPassword` is set. Used by the command line, never by a web route.
   */
  async function createOperator(input: {
    email: string;
    password: string;
    role: "SUPPORT" | "ADMIN";
    resetPassword?: boolean;
  }): Promise<{ userId: string; created: boolean }> {
    const email = normalizeEmail(input.email);
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { emailCanonical: canonicalEmail(email) }] } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: input.role,
          emailVerifiedAt: existing.emailVerifiedAt ?? now(),
          ...(input.resetPassword ? { passwordHash: await hashPassword(input.password) } : {}),
        },
      });
      if (input.resetPassword) await prisma.session.deleteMany({ where: { userId: existing.id } });
      return { userId: existing.id, created: false };
    }
    const user = await prisma.user.create({
      data: {
        email,
        emailCanonical: canonicalEmail(email),
        passwordHash: await hashPassword(input.password),
        role: input.role,
        termsAcceptedAt: now(),
        emailVerifiedAt: now(),
        onboardingCompletedAt: now(),
      },
    });
    return { userId: user.id, created: true };
  }

  /** Deletes the account with everything attached (cascade). */
  async function deleteAccount(userId: string, password: string): Promise<{ ok: boolean }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) return { ok: false };
    // The farewell goes through the outbox: the user (and the chat link) is gone by then.
    await prisma.$transaction([
      ...(user.telegramId !== null
        ? [
            prisma.telegramOutbox.create({
              data: { telegramId: user.telegramId, kind: "account_deleted", locale: user.locale },
            }),
          ]
        : []),
      prisma.user.delete({ where: { id: userId } }),
    ]);
    return { ok: true };
  }

  return {
    register,
    login,
    requestPasswordReset,
    resetPassword,
    verifyEmail,
    sendVerificationEmail,
    changePassword,
    createOperator,
    deleteAccount,
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
