import { describe, expect, it } from "vitest";
import { safeNextPath, shouldRedirectToLogin } from "./route-guard";

describe("shouldRedirectToLogin", () => {
  it("sends anonymous visitors away from the signed-in area", () => {
    for (const path of ["/dashboard", "/settings", "/onboarding", "/links", "/services/dni/renaper", "/admin", "/admin/users/abc"]) {
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

describe("safeNextPath", () => {
  it("keeps paths inside this site", () => {
    expect(safeNextPath("/admin")).toBe("/admin");
    expect(safeNextPath("/admin/users?q=ana&page=2")).toBe("/admin/users?q=ana&page=2");
    expect(safeNextPath("/services/dni/renaper")).toBe("/services/dni/renaper");
  });

  it("drops anything that could leave the site", () => {
    for (const value of ["https://evil.example", "//evil.example", "/\\evil", "javascript:alert(1)", "admin", "", null, undefined]) {
      expect(safeNextPath(value as string | null | undefined)).toBeNull();
    }
  });
});
