import { z } from "zod";
import { APP_CONFIG } from "../config/app";
import { TRACKER_CONFIG } from "../config/trackers";
import { findJurisdiction } from "../config/pjn";
import type { MessageKey } from "../i18n/ru";
import { normalizeSpaces, holderBirthDateSchema } from "./profile";
import { normalizeCorreoReference } from "./correo";
import { onlyDigits } from "./trackers-utils";
import { OCASA_NUMBER_LENGTH } from "./ocasa";

const msg = (key: MessageKey) => ({ message: key });

export const TRACKER_KINDS = ["DNM_DNI", "RENAPER", "CORREO", "OCASA", "DNM_CITIZENSHIP", "PJN"] as const;

/** Kinds read from Migraciones: they also need the holder's birth date. */
export const DNM_KINDS = ["DNM_DNI", "DNM_CITIZENSHIP"] as const;
export type DnmKind = (typeof DNM_KINDS)[number];
export function isDnmKind(kind: string): kind is DnmKind {
  return (DNM_KINDS as readonly string[]).includes(kind);
}
export type TrackerKindValue = (typeof TRACKER_KINDS)[number];

/**
 * Sources that are never read automatically: the person updates them by hand. OCASA protects its page with a
 * "not a robot" check, so the case is added, but it only changes when its owner pastes what the page shows.
 * Switching a source to automatic reading later means removing it from this list and adding its reader.
 */
export const MANUAL_KINDS = ["OCASA"] as const satisfies readonly TrackerKindValue[];
export function isManualKind(kind: string): boolean {
  return (MANUAL_KINDS as readonly string[]).includes(kind);
}

/**
 * Sources switched off for everybody, staff included: no section in the menu, no way to add or refresh a case,
 * and cases that already exist stay out of the lists. OCASA is parked here until there is an agreement with them.
 * Switch it back on by emptying this list and `DISABLED_SECTIONS`.
 */
export const DISABLED_KINDS: readonly TrackerKindValue[] = ["OCASA"];
export function isDisabledKind(kind: string, kinds: readonly string[] = DISABLED_KINDS): boolean {
  return kinds.includes(kind);
}

/**
 * Sources not open to everyone yet: shown to staff and to accounts with early access only. OCASA is parked here
 * (a stub) until there is an agreement with them; a service is hidden by listing its kind here and its section in
 * `EARLY_ACCESS_SECTIONS`, and opened by emptying both.
 */
export const EARLY_ACCESS_KINDS: readonly TrackerKindValue[] = ["OCASA"];
export function isEarlyAccessKind(kind: string, kinds: readonly string[] = EARLY_ACCESS_KINDS): boolean {
  return kinds.includes(kind);
}

export const TRACKER_STATUSES = ["PENDING_CONFIRMATION", "ACTIVE", "FINISHED", "PAUSED"] as const;
export type TrackerStatusValue = (typeof TRACKER_STATUSES)[number];

/** One stage as shown to the user (RENAPER / Correo / PJN alike). */
export interface TrackerStep {
  date: string;
  title: string;
  detail: string;
}

/** Flat key -> value header of a case / trámite (keys are translated in the UI). */
export type TrackerHeaderFields = Record<string, string>;

/** Service (notification switch) a tracker kind belongs to. */
export const TRACKER_KIND_SECTION = {
  DNM_DNI: "dni_approval",
  RENAPER: "dni_production",
  CORREO: "dni_post",
  OCASA: "post_ocasa",
  DNM_CITIZENSHIP: "citizenship_dnm",
  PJN: "citizenship_court",
} as const satisfies Record<TrackerKindValue, string>;

export { onlyDigits };

export const tramiteNumberSchema = z
  .string()
  .transform(onlyDigits)
  .pipe(
    z
      .string()
      .min(TRACKER_CONFIG.tramiteNumber.minDigits, msg("validation.tramiteInvalid"))
      .max(TRACKER_CONFIG.tramiteNumber.maxDigits, msg("validation.tramiteInvalid")),
  );

/** OCASA tracking number: the trámite number padded with zeros to 12 digits (000755824304). */
export const ocasaNumberSchema = tramiteNumberSchema.transform((digits) => digits.padStart(OCASA_NUMBER_LENGTH, "0"));

/** A Correo reference: plain digits (DNI) or "<form>:<…>", validated against the form's own rules. */
export const correoReferenceSchema = z.string().transform((value, ctx) => {
  const reference = normalizeCorreoReference(value);
  if (reference === null) {
    ctx.addIssue({ code: "custom", message: "validation.correoInvalid" satisfies MessageKey });
    return z.NEVER;
  }
  return reference;
});

export const pjnJurisdictionSchema = z
  .string()
  .refine((value) => Boolean(findJurisdiction(value)), msg("validation.jurisdictionInvalid"));

const currentYear = () => new Date().getUTCFullYear();

export const pjnCaseSchema = z.object({
  jurisdiction: pjnJurisdictionSchema,
  number: z
    .string()
    .transform(onlyDigits)
    .pipe(
      z
        .string()
        .min(1, msg("validation.caseNumberInvalid"))
        .max(TRACKER_CONFIG.pjn.maxNumberDigits, msg("validation.caseNumberInvalid")),
    )
    .transform((value) => String(Number(value))),
  year: z
    .string()
    .transform(onlyDigits)
    .pipe(z.string().length(4, msg("validation.caseYearInvalid")))
    .refine(
      (value) => Number(value) >= TRACKER_CONFIG.pjn.minYear && Number(value) <= currentYear(),
      msg("validation.caseYearInvalid"),
    ),
});
export type PjnCaseInput = z.infer<typeof pjnCaseSchema>;

export const addTrackerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("DNM_DNI"), number: tramiteNumberSchema, birthDate: holderBirthDateSchema.optional() }),
  z.object({
    kind: z.literal("DNM_CITIZENSHIP"),
    number: tramiteNumberSchema,
    birthDate: holderBirthDateSchema.optional(),
  }),
  z.object({ kind: z.literal("RENAPER"), number: tramiteNumberSchema }),
  z.object({ kind: z.literal("CORREO"), number: correoReferenceSchema }),
  z.object({ kind: z.literal("OCASA"), number: ocasaNumberSchema }),
  z.object({ kind: z.literal("PJN") }).merge(pjnCaseSchema),
]);
export type AddTrackerInput = z.infer<typeof addTrackerSchema>;

/** Custom name of a case ("Mamá", "Sud Paraná"…): optional, trimmed, empty means none. */
export const trackerLabelSchema = z
  .string()
  .transform(normalizeSpaces)
  .pipe(z.string().max(APP_CONFIG.limits.labelMaxLength, msg("validation.nameTooLong")))
  .transform((value) => (value === "" ? null : value));

/** Add request: the tracker data, who it is for (omitted = the account owner) and an optional name. */
export const addTrackerRequestSchema = z.intersection(
  addTrackerSchema,
  z.object({
    label: trackerLabelSchema.optional(),
  }),
);

/** Stable key of a PJN case inside `Tracker.reference`. */
export function pjnReference(input: { jurisdiction: string; number: string; year: string }): string {
  return `${input.jurisdiction}:${input.number}:${input.year}`;
}

export function parsePjnReference(
  reference: string,
): { jurisdiction: string; number: string; year: string } | null {
  const [jurisdiction, number, year] = reference.split(":");
  if (!jurisdiction || !number || !year) return null;
  return { jurisdiction, number, year };
}
