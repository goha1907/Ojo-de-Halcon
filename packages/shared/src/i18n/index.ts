import { APP_CONFIG, LOCALES, type Locale } from "../config/app";
import { en } from "./en";
import { es } from "./es";
import { ru, type MessageKey, type Messages } from "./ru";

export type { MessageKey, Messages };

const DICTIONARIES: Record<Locale, Messages> = { ru, es, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: string | null | undefined): Locale {
  if (!value) return APP_CONFIG.defaultLocale;
  const short = value.toLowerCase().slice(0, 2);
  return isLocale(short) ? short : APP_CONFIG.defaultLocale;
}

export type TranslateFn = (key: MessageKey, params?: Record<string, string | number>) => string;

export function createTranslator(locale: Locale): TranslateFn {
  const dictionary = DICTIONARIES[locale];
  return (key, params) => {
    const template = dictionary[key];
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  };
}

/** Returns the message for a key coming from untyped data (e.g. validation issues). */
export function translateLoose(t: TranslateFn, key: string): string {
  return key in ru ? t(key as MessageKey) : key;
}
