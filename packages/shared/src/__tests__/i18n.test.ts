import { describe, expect, it } from "vitest";
import { LOCALES, createTranslator, resolveLocale } from "../index";
import { en } from "../i18n/en";
import { es } from "../i18n/es";
import { ru } from "../i18n/ru";

const DICTIONARIES = { ru, es, en } as const;
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();

describe("dictionaries", () => {
  it("cover every locale of the app", () => {
    expect(Object.keys(DICTIONARIES).sort()).toEqual([...LOCALES].sort());
  });

  it("have the same keys everywhere", () => {
    const keys = Object.keys(ru).sort();
    expect(Object.keys(es).sort()).toEqual(keys);
    expect(Object.keys(en).sort()).toEqual(keys);
  });

  it("use the same placeholders as the Russian source", () => {
    for (const [key, text] of Object.entries(ru)) {
      expect(placeholders((es as Record<string, string>)[key]!), `es ${key}`).toEqual(placeholders(text));
      expect(placeholders((en as Record<string, string>)[key]!), `en ${key}`).toEqual(placeholders(text));
    }
  });

  it("have no empty texts and no Russian letters in Spanish or English", () => {
    for (const [locale, dictionary] of [["es", es], ["en", en]] as const) {
      for (const [key, text] of Object.entries(dictionary)) {
        expect(text.trim().length, `${locale} ${key}`).toBeGreaterThan(0);
        expect(/[А-Яа-яЁё]/.test(text), `${locale} ${key}`).toBe(false);
      }
    }
  });
});

describe("locale resolution", () => {
  it("recognises the three languages from a header or a cookie", () => {
    expect(resolveLocale("en-US,en;q=0.9")).toBe("en");
    expect(resolveLocale("es-AR")).toBe("es");
    expect(resolveLocale("ru")).toBe("ru");
    expect(resolveLocale("fr-FR")).toBe("ru");
    expect(resolveLocale(null)).toBe("ru");
  });

  it("translates with the chosen language", () => {
    expect(createTranslator("en")("common.save")).toBe("Save");
    expect(createTranslator("es")("common.save")).toBe("Guardar");
    expect(createTranslator("ru")("field.passwordHint", { min: 8 })).toContain("8");
  });
});
