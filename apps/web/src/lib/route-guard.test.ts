import { describe, expect, it } from "vitest";
import { shouldRedirectToLogin } from "./route-guard";

describe("shouldRedirectToLogin", () => {
  it("sends anonymous visitors away from the signed-in area", () => {
    for (const path of ["/dashboard", "/settings", "/onboarding", "/links", "/services/dni/renaper"]) {
      expect(shouldRedirectToLogin(path, false)).toBe(true);
    }
  });

  it("never redirects when a cookie exists (validity is checked on the server)", () => {
    expect(shouldRedirectToLogin("/dashboard", true)).toBe(false);
  });

  it("never redirects guest pages, with or without a cookie (no redirect loops)", () => {
    for (const path of ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/"]) {
      expect(shouldRedirectToLogin(path, false)).toBe(false);
      expect(shouldRedirectToLogin(path, true)).toBe(false);
    }
  });

  it("does not treat similarly named paths as protected", () => {
    expect(shouldRedirectToLogin("/newsletter", false)).toBe(false);
    expect(shouldRedirectToLogin("/services-info", false)).toBe(false);
  });
});
