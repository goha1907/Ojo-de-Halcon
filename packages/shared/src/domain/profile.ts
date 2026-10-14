import { z } from "zod";
import { APP_CONFIG } from "../config/app";
import { DISPOSABLE_EMAIL_DOMAINS, GMAIL_DOMAINS } from "../config/email";
import { findJurisdiction } from "../config/pjn";
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

/**
 * One key per real mailbox: lower case, `+tag` removed, and for Gmail also
 * dots removed and `googlemail.com` mapped to `gmail.com`. Used to stop one
 * person from creating several accounts (and trials) with address variations.
 */
export function canonicalEmail(value: string): string {
  const email = normalizeEmail(value);
  const at = email.lastIndexOf("@");
  if (at < 1) return email;
  let local = email.slice(0, at).split("+")[0]!;
  let domain = email.slice(at + 1);
  if (GMAIL_DOMAINS.includes(domain)) {
    local = local.replaceAll(".", "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

export function isDisposableEmail(value: string): boolean {
  const domain = normalizeEmail(value).split("@").pop() ?? "";
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
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

/** Days in a calendar month; an unknown year is treated as a leap year (Feb → 29). */
export function daysInMonth(year: number | null, month: number): number {
  return new Date(Date.UTC(year ?? 2000, month, 0)).getUTCDate();
}

/**
 * Birth years offered in the date dropdowns, newest first: from the youngest
 * allowed account holder down to the oldest plausible age.
 */
export function birthYearOptions(
  today: Date = new Date(),
  minAgeYears: number = APP_CONFIG.profile.minAccountAgeYears,
): number[] {
  const newest = today.getUTCFullYear() - minAgeYears;
  const oldest = today.getUTCFullYear() - APP_CONFIG.profile.maxAgeYears;
  const years: number[] = [];
  for (let year = newest; year >= oldest; year -= 1) years.push(year);
  return years;
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

/** Birth date as an ISO string (output: UTC Date) with a minimum age; 0 allows children. */
export const makeBirthDateSchema = (minAgeYears: number) =>
  z
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
    if (age < minAgeYears) {
      ctx.addIssue({ code: "custom", message: "validation.ageTooYoung" });
      return z.NEVER;
    }
    if (age > APP_CONFIG.profile.maxAgeYears) {
      ctx.addIssue({ code: "custom", message: "validation.ageTooOld" });
      return z.NEVER;
    }
    return date;
  });

/** Court used to find the user's case by name; empty string means "not chosen". */
export const courtSchema = z
  .string()
  .default("")
  .refine((value) => value === "" || Boolean(findJurisdiction(value)), msg("validation.jurisdictionInvalid"));

/** Account owner: must be an adult. */
export const birthDateSchema = makeBirthDateSchema(APP_CONFIG.profile.minAccountAgeYears);
/** Relative tracked by the owner: any age (children are tracked by a guardian). */
export const personBirthDateSchema = makeBirthDateSchema(0);

/** Makes a birth date optional: empty input is `null`, anything else must be valid. */
function optionalBirthDate(schema: ReturnType<typeof makeBirthDateSchema>) {
  return z.string().transform((value, ctx) => {
    if (!value.trim()) return null;
    const parsed = schema.safeParse(value);
    if (parsed.success) return parsed.data;
    for (const issue of parsed.error.issues) ctx.addIssue({ code: "custom", message: issue.message });
    return z.NEVER;
  });
}

/** Birth date of the owner: optional (only some sources need it), 18+ when given. */
export const optionalBirthDateSchema = optionalBirthDate(birthDateSchema);
/** Birth date of a relative: optional, any age. */
export const optionalPersonBirthDateSchema = optionalBirthDate(personBirthDateSchema);

export const profileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  birthDate: optionalBirthDateSchema,
  pjnJurisdiction: courtSchema,
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
    email: emailSchema.refine((value) => !isDisposableEmail(value), msg("validation.emailDisposable")),
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

/** A relative: name, birth date and (optionally) the court used for the name search. */

export const personSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  birthDate: optionalPersonBirthDateSchema,
  pjnJurisdiction: courtSchema,
  /** Send this person's updates to the owner's Telegram. */
  notifyTelegram: z.boolean().default(true),
});
export type PersonInput = z.infer<typeof personSchema>;
