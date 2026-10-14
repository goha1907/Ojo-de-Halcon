import { describe, expect, it } from "vitest";
import {
  ageInYears,
  birthYearOptions,
  composeIsoDate,
  daysInMonth,
  emailSchema,
  loginSchema,
  parseIsoDate,
  profileSchema,
  registerSchema,
  resetPasswordSchema,
  splitIsoDate,
} from "../domain/profile";

const adult = { firstName: "Egor", lastName: "Medvedev", birthDate: "1987-07-19" };

describe("dates", () => {
  it("parses real dates and rejects impossible ones", () => {
    expect(parseIsoDate("1987-07-19")?.toISOString()).toBe("1987-07-19T00:00:00.000Z");
    expect(parseIsoDate("2001-02-30")).toBeNull();
    expect(parseIsoDate("19.07.1987")).toBeNull();
  });

  it("counts full years only", () => {
    const birth = new Date("2000-03-15T00:00:00Z");
    expect(ageInYears(birth, new Date("2026-03-14T00:00:00Z"))).toBe(25);
    expect(ageInYears(birth, new Date("2026-03-15T00:00:00Z"))).toBe(26);
  });

  it("composes and splits the three birth date inputs", () => {
    expect(composeIsoDate({ day: "9", month: "2", year: "1987" })).toBe("1987-02-09");
    expect(composeIsoDate({ day: "", month: "", year: "" })).toBe("");
    expect(splitIsoDate("1987-07-09")).toEqual({ day: "9", month: "7", year: "1987" });
    expect(splitIsoDate(null)).toEqual({ day: "", month: "", year: "" });
  });

  it("flags partially filled dates via the schema", () => {
    const iso = composeIsoDate({ day: "19", month: "", year: "1987" });
    const result = profileSchema.safeParse({ ...adult, birthDate: iso });
    expect(result.error!.issues[0]!.message).toBe("validation.birthDateInvalid");
  });
});

describe("date dropdown helpers", () => {
  it("knows month lengths including leap years", () => {
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(null, 2)).toBe(29);
    expect(daysInMonth(2024, 4)).toBe(30);
    expect(daysInMonth(2024, 12)).toBe(31);
  });

  it("offers years from the youngest allowed to the oldest plausible, newest first", () => {
    const years = birthYearOptions(new Date("2026-10-13T00:00:00Z"));
    expect(years[0]).toBe(2008); // 18 years old
    expect(years[years.length - 1]).toBe(1906); // 120 years old
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });
});

describe("profileSchema", () => {
  it("normalizes names and parses the date", () => {
    const parsed = profileSchema.parse({ ...adult, firstName: "  Maria   Victoria " });
    expect(parsed.firstName).toBe("Maria Victoria");
    expect(parsed.birthDate).toBeInstanceOf(Date);
  });

  it("accepts Cyrillic, hyphens and apostrophes", () => {
    expect(profileSchema.safeParse({ ...adult, firstName: "Анна-Мария", lastName: "О'Брайен" }).success).toBe(true);
  });

  it("returns i18n keys for errors", () => {
    const result = profileSchema.safeParse({ firstName: "", lastName: "X1", birthDate: "2999-01-01" });
    const messages = result.error!.issues.map((i) => i.message);
    expect(messages).toEqual(
      expect.arrayContaining(["validation.required", "validation.nameInvalid", "validation.birthDateFuture"]),
    );
  });

  it("rejects minors and implausible ages", () => {
    const recent = new Date();
    recent.setUTCFullYear(recent.getUTCFullYear() - 10);
    const minor = profileSchema.safeParse({ ...adult, birthDate: recent.toISOString().slice(0, 10) });
    expect(minor.error!.issues[0]!.message).toBe("validation.ageTooYoung");
    expect(profileSchema.safeParse({ ...adult, birthDate: "1850-01-01" }).error!.issues[0]!.message).toBe(
      "validation.ageTooOld",
    );
  });
});

describe("credentials", () => {
  it("normalizes e-mail and validates its shape", () => {
    expect(emailSchema.parse("  Egor@Example.COM ")).toBe("egor@example.com");
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
    expect(emailSchema.safeParse("").error!.issues[0]!.message).toBe("validation.required");
  });

  it("registration needs matching passwords and consent", () => {
    const base = { email: "a@b.co", password: "longenough1", passwordConfirm: "longenough1", acceptTerms: true };
    expect(registerSchema.safeParse(base).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
    const mismatch = registerSchema.safeParse({ ...base, passwordConfirm: "different1" });
    expect(mismatch.error!.issues[0]!.message).toBe("validation.passwordMismatch");
    expect(registerSchema.safeParse({ ...base, password: "short", passwordConfirm: "short" }).error!.issues[0]!.message)
      .toBe("validation.passwordTooShort");
  });

  it("login and reset schemas", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: "t", password: "longenough1", passwordConfirm: "longenough1" }).success).toBe(true);
  });
});

describe("canonical e-mail", () => {
  it("maps address variations of one mailbox to one key", async () => {
    const { canonicalEmail } = await import("../index");
    expect(canonicalEmail("E.G.o.r+trial@Gmail.com")).toBe("egor@gmail.com");
    expect(canonicalEmail("egor@googlemail.com")).toBe("egor@gmail.com");
    expect(canonicalEmail("Ivan.Petrov+x@mail.ru")).toBe("ivan.petrov@mail.ru");
  });

  it("rejects disposable domains on registration only", async () => {
    const { isDisposableEmail, registerSchema } = await import("../index");
    expect(isDisposableEmail("a@Mailinator.com")).toBe(true);
    expect(isDisposableEmail("a@gmail.com")).toBe(false);
    const base = { password: "password-123", passwordConfirm: "password-123", acceptTerms: true as const };
    expect(registerSchema.safeParse({ ...base, email: "x@yopmail.com" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, email: "x@gmail.com" }).success).toBe(true);
  });
});
