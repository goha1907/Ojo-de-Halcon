import { onlyDigits } from "./trackers-utils";

/**
 * Correo Argentino tracking forms. Every item of the site's "Tipo de envío" list is its own page
 * (`/formularios/<page>`) with its own fields; they all post to one endpoint with
 * `action`, `id`, `producto`, `pais`. Adding a form = one entry here + its i18n labels.
 */
export type CorreoLayout =
  /** two-letter product prefix + 7–9 digit number (the country is always AR) */
  | "coded"
  /** one code: 2 letters + 9 digits + 2 letters */
  | "upu"
  /** trámite number, digits only, padded by the site to 12 */
  | "tramite"
  /** free alphanumeric shipment number */
  | "parcel";

export interface CorreoFormDef {
  /** `action` sent to the site. */
  action: string;
  /** Last URL segment of the form page on correoargentino.com.ar/formularios. */
  page: string;
  layout: CorreoLayout;
  /** Prefixes of the "coded" layout, in the site's order (first is the default). */
  products?: readonly string[];
  /** Longest code the site accepts. */
  maxLength: number;
}

const NATIONAL_PRODUCTS = [
  "CC", "CD", "CL", "CM", "CO", "CP", "DE", "DI", "EC", "EE", "EO", "EP", "GC", "GD", "GE", "GF", "GO", "GR",
  "GS", "HC", "HD", "HE", "HO", "HU", "HX", "IN", "IS", "JP", "LC", "LS", "ND", "MD", "ME", "MC", "MS", "MU",
  "MX", "OL", "PC", "PP", "RD", "RE", "RP", "RR", "SD", "SL", "SP", "SR", "ST", "TC", "TD", "TL", "UP",
] as const;

export const CORREO_FORMS = {
  ondnp: { action: "ondnp", page: "ondnp", layout: "coded", products: ["CU", "SU", "EU", "PU", "XU"], maxLength: 9 },
  ondnc: { action: "ondnc", page: "ondnc", layout: "coded", products: NATIONAL_PRODUCTS, maxLength: 9 },
  ondi: {
    action: "ondi",
    page: "ondi",
    layout: "coded",
    products: ["EE", "CX", "LA", "RR", "XP", "XX", "XR", "RP"],
    maxLength: 9,
  },
  oidn: { action: "oidn", page: "oidn", layout: "upu", maxLength: 13 },
  ondng: { action: "ondng", page: "ondng", layout: "tramite", maxLength: 12 },
  onpa: { action: "onpa", page: "onpa", layout: "tramite", maxLength: 12 },
  mercadolibre: { action: "mercadolibre", page: "mercadolibre", layout: "parcel", maxLength: 23 },
  ecommerce: { action: "ecommerce", page: "e-commerce", layout: "parcel", maxLength: 40 },
} as const satisfies Record<string, CorreoFormDef>;

export type CorreoFormKey = keyof typeof CORREO_FORMS;
export const CORREO_FORM_KEYS = Object.keys(CORREO_FORMS) as CorreoFormKey[];
/** Preselected form of the add dialog. */
export const CORREO_DEFAULT_FORM: CorreoFormKey = "ondnp";

export function isCorreoForm(value: string): value is CorreoFormKey {
  return Object.hasOwn(CORREO_FORMS, value);
}

export function correoFormDef(form: CorreoFormKey): CorreoFormDef {
  return CORREO_FORMS[form];
}

/** Public page of a form (shown as a link next to the field). */
export function correoFormUrl(form: CorreoFormKey): string {
  return `https://www.correoargentino.com.ar/formularios/${CORREO_FORMS[form].page}`;
}

export interface CorreoInput {
  form: CorreoFormKey;
  /** Prefix of the "coded" layout. */
  producto?: string;
  /** Code as typed. */
  number: string;
}

export type CorreoField = "producto" | "number";
export type CorreoIssue = { field: CorreoField; message: "validation.correoProduct" | "validation.correoInvalid" };

const TRAMITE_DIGITS = { min: 6, max: 12 };

/** Canonical reference of a form input; `null` + the issue when the input is not valid. */
export function correoReference(input: CorreoInput): { ok: true; reference: string } | { ok: false; issue: CorreoIssue } {
  const def = CORREO_FORMS[input.form] as CorreoFormDef;
  const invalid = { ok: false, issue: { field: "number", message: "validation.correoInvalid" } } as const;
  const typed = input.number.trim();
  switch (def.layout) {
    case "coded": {
      const producto = (input.producto ?? "").toUpperCase();
      if (!def.products?.includes(producto)) {
        return { ok: false, issue: { field: "producto", message: "validation.correoProduct" } };
      }
      const digits = typed.replace(/[\s.-]/g, "");
      if (!/^\d{7,9}$/.test(digits)) return invalid;
      return { ok: true, reference: `${def.action}:${producto}:${digits}` };
    }
    case "upu": {
      const code = typed.replace(/\s/g, "").toUpperCase();
      return /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code) ? { ok: true, reference: `${def.action}:${code}` } : invalid;
    }
    case "tramite": {
      const digits = onlyDigits(typed);
      if (digits.length < TRAMITE_DIGITS.min || digits.length > TRAMITE_DIGITS.max) return invalid;
      // the DNI form keeps the plain-digits reference used before there were several forms
      return { ok: true, reference: input.form === "ondng" ? digits : `${def.action}:${digits}` };
    }
    case "parcel": {
      const code = typed.replace(/\s/g, "");
      if (!/^[A-Za-z0-9]+$/.test(code) || code.length > def.maxLength) return invalid;
      return { ok: true, reference: `${def.action}:${code}` };
    }
  }
}

export interface ParsedCorreoReference {
  form: CorreoFormKey;
  producto?: string;
  /** The code the site is asked with. */
  id: string;
}

function formByAction(action: string): CorreoFormKey | null {
  return CORREO_FORM_KEYS.find((key) => CORREO_FORMS[key].action === action) ?? null;
}

/** Splits a stored reference; plain digits are a DNI trámite (the first supported form). */
export function parseCorreoReference(reference: string): ParsedCorreoReference | null {
  if (/^\d+$/.test(reference)) return { form: "ondng", id: reference };
  const [action, ...rest] = reference.split(":");
  const form = action ? formByAction(action) : null;
  if (!form) return null;
  const def = CORREO_FORMS[form] as CorreoFormDef;
  if (def.layout === "coded") {
    const [producto, id] = rest;
    return producto && id ? { form, producto, id } : null;
  }
  const id = rest[0];
  return id ? { form, id } : null;
}

/** Re-validates a stored or submitted reference and returns its canonical form. */
export function normalizeCorreoReference(reference: string): string | null {
  const trimmed = reference.trim();
  if (!trimmed.includes(":")) {
    const result = correoReference({ form: "ondng", number: trimmed });
    return result.ok ? result.reference : null;
  }
  const parsed = parseCorreoReference(trimmed);
  if (!parsed) return null;
  const result = correoReference({ form: parsed.form, producto: parsed.producto, number: parsed.id });
  return result.ok ? result.reference : null;
}

/** What people see as the case number: "CU 123456789", "AB123456789CD", the trámite digits. */
export function correoDisplay(reference: string): string {
  const parsed = parseCorreoReference(reference);
  if (!parsed) return reference;
  return parsed.producto ? `${parsed.producto} ${parsed.id}` : parsed.id;
}
