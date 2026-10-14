import { z } from "zod";
import { APP_CONFIG } from "../config/app";
import { TRACKER_CONFIG } from "../config/trackers";
import { findJurisdiction } from "../config/pjn";
import type { MessageKey } from "../i18n/ru";
import { normalizeSpaces, holderBirthDateSchema } from "./profile";
import { normalizeCorreoReference } from "./correo";
import { onlyDigits } from "./trackers-utils";

const msg = (key: MessageKey) => ({ message: key });

export const TRACKER_KINDS = ["DNM_DNI", "RENAPER", "CORREO", "DNM_CITIZENSHIP", "PJN"] as const;

/** Kinds read from Migraciones: they also need the holder's birth date. */
export const DNM_KINDS = ["DNM_DNI", "DNM_CITIZENSHIP"] as const;
export type DnmKind = (typeof DNM_KINDS)[number];
export function isDnmKind(kind: string): kind is DnmKind {
  return (DNM_KINDS as readonly string[]).includes(kind);
}
export type TrackerKindValue = (typeof TRACKER_KINDS)[number];

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

function normalizeWord(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The part of a carátula before " S/" holds the parties. */
export function caratulaParties(caratula: string): string {
  const index = caratula.toUpperCase().indexOf(" S/");
  return normalizeWord(index > 0 ? caratula.slice(0, index) : caratula);
}

/**
 * True when every word of the first and last name appears in the parties part
 * of the carátula (order and accents ignored: "MEDVEDEV, EGOR" matches
 * "Egor Medvedev").
 */
export function caratulaMatchesName(caratula: string, firstName: string, lastName: string): boolean {
  const parties = ` ${caratulaParties(caratula)} `;
  const words = normalizeWord(`${firstName} ${lastName}`).split(" ").filter(Boolean);
  return words.length > 0 && words.every((word) => parties.includes(` ${word} `));
}

/** "CNE 007900/2026" -> { number: "7900", year: "2026" } */
export function parseExpediente(expediente: string): { number: string; year: string } | null {
  const match = /(\d{1,7})\s*\/\s*(\d{4})/.exec(expediente);
  return match ? { number: String(Number(match[1])), year: match[2]! } : null;
}
