import { z } from "zod";
import { APP_CONFIG } from "../config/app";
import type { MessageKey } from "../i18n/ru";

/** Validation messages are i18n keys, translated at the UI boundary. */
const msg = (key: MessageKey) => ({ message: key });

const NAME_PATTERN = /^\p{L}[\p{L}\p{M}' .-]*$/u;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// Pragmatic address check; real verification is the e-mail link.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Full years between `birth` and `today` (both interpreted as UTC dates). */
export function ageInYears(birth: Date, today: Date): number {
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

/** Parses `YYYY-MM-DD` into a UTC Date; returns null for impossible dates (e.g. 2001-02-30). */
export function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === value ? date : null;
}

/**
 * Joins separate day / month / year inputs into `YYYY-MM-DD`. Returns an
 * empty string when nothing is filled, and a non-date string when parts are
 * missing or malformed, so the schema reports the right error.
 */
export function composeIsoDate(parts: { day: string; month: string; year: string }): string {
  const day = parts.day.trim();
  const month = parts.month.trim();
  const year = parts.year.trim();
  if (!day && !month && !year) return "";
  const pad = (value: string, length: number) => value.padStart(length, "0");
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** Splits `YYYY-MM-DD` back into the three form inputs. */
export function splitIsoDate(iso: string | null | undefined): { day: string; month: string; year: string } {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!match) return { day: "", month: "", year: "" };
  return { year: match[1]!, month: String(Number(match[2])), day: String(Number(match[3])) };
}

export const nameSchema = z
  .string()
  .transform(normalizeSpaces)
  .pipe(
    z
      .string()
      .min(1, msg("validation.required"))
      .max(APP_CONFIG.profile.nameMaxLength, msg("validation.nameTooLong"))
      .regex(NAME_PATTERN, msg("validation.nameInvalid")),
  );

/** Birth date as an ISO string; output is a UTC Date. */
export const birthDateSchema = z
  .string()
  .min(1, msg("validation.required"))
  .transform((value, ctx) => {
    const date = parseIsoDate(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message: "validation.birthDateInvalid" });
      return z.NEVER;
    }
    const age = ageInYears(date, new Date());
    if (date.getTime() > Date.now()) {
      ctx.addIssue({ code: "custom", message: "validation.birthDateFuture" });
      return z.NEVER;
    }
    if (age < APP_CONFIG.profile.minAccountAgeYears) {
      ctx.addIssue({ code: "custom", message: "validation.ageTooYoung" });
      return z.NEVER;
    }
    if (age > APP_CONFIG.profile.maxAgeYears) {
      ctx.addIssue({ code: "custom", message: "validation.ageTooOld" });
      return z.NEVER;
    }
    return date;
  });

export const profileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  birthDate: birthDateSchema,
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const emailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(
    z
      .string()
      .min(1, msg("validation.required"))
      .max(254, msg("validation.emailInvalid"))
      .regex(EMAIL_PATTERN, msg("validation.emailInvalid")),
  );

export const passwordSchema = z
  .string()
  .min(APP_CONFIG.auth.password.minLength, msg("validation.passwordTooShort"))
  .max(APP_CONFIG.auth.password.maxLength, msg("validation.passwordTooLong"));

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
    acceptTerms: z.literal(true, msg("validation.consentRequired")),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    path: ["passwordConfirm"],
    ...msg("validation.passwordMismatch"),
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, msg("validation.required")),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    path: ["passwordConfirm"],
    ...msg("validation.passwordMismatch"),
  });
