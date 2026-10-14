import { describe, expect, it } from "vitest";
import { loadEnv } from "../config/env";
import { buildBotDeepLink } from "../domain/auth";
import { TRACKER_SECTIONS } from "../domain/events";
import { es } from "../i18n/es";
import { createTranslator, resolveLocale } from "../i18n/index";
import { ru } from "../i18n/ru";

const baseEnv = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  SESSION_SECRET: "x".repeat(32),
};

describe("loadEnv", () => {
  it("applies defaults and strips @ from bot username", () => {
    const env = loadEnv({ ...baseEnv, TELEGRAM_BOT_USERNAME: "@OjoBot" });
    expect(env.SESSION_TTL_DAYS).toBe(30);
    expect(env.TELEGRAM_LINK_CODE_TTL_MINUTES).toBe(10);
    expect(env.EMAIL_VERIFICATION_REQUIRED).toBe(false);
    expect(env.TELEGRAM_BOT_USERNAME).toBe("OjoBot");
  });
  it("parses the verification flag", () => {
    expect(loadEnv({ ...baseEnv, EMAIL_VERIFICATION_REQUIRED: "true" }).EMAIL_VERIFICATION_REQUIRED).toBe(true);
    expect(() => loadEnv({ ...baseEnv, EMAIL_VERIFICATION_REQUIRED: "yes" })).toThrow();
  });
  it("fails with a readable message", () => {
    expect(() => loadEnv({ ...baseEnv, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
    expect(() => loadEnv({})).toThrow(/Invalid environment/);
  });
});

describe("services", () => {
  it("has a label for every section in the dictionary", () => {
    for (const section of TRACKER_SECTIONS) expect(`sections.${section}` in ru).toBe(true);
  });
});

describe("i18n", () => {
  it("es has exactly the keys of ru", () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(ru).sort());
  });
  it("interpolates params and resolves locales", () => {
    expect(createTranslator("ru")("dashboard.welcome", { name: "Егор" })).toBe("Здравствуйте, Егор!");
    expect(resolveLocale("es-AR")).toBe("es");
    expect(resolveLocale("de")).toBe("ru");
    expect(resolveLocale(null)).toBe("ru");
  });
});

describe("buildBotDeepLink", () => {
  it("puts the code into the start payload", () => {
    expect(buildBotDeepLink("OjoBot", "abc_DEF-123")).toBe("https://t.me/OjoBot?start=abc_DEF-123");
  });
});
