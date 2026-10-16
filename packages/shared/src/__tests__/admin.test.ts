import { describe, expect, it } from "vitest";
import { ADMIN_PERMISSIONS, can, isStaff } from "../index";

describe("admin permissions", () => {
  it("lets an admin do everything", () => {
    for (const permission of ADMIN_PERMISSIONS) expect(can("ADMIN", permission)).toBe(true);
  });

  it("keeps customers out", () => {
    for (const permission of ADMIN_PERMISSIONS) expect(can("USER", permission)).toBe(false);
    expect(isStaff("USER")).toBe(false);
    expect(isStaff(null)).toBe(false);
  });

  it("gives support only reading and the inbox", () => {
    expect(isStaff("SUPPORT")).toBe(true);
    expect(can("SUPPORT", "users.read")).toBe(true);
    expect(can("SUPPORT", "feedback.manage")).toBe(true);
    expect(can("SUPPORT", "grants.manage")).toBe(false);
    expect(can("SUPPORT", "audit.read")).toBe(false);
  });
});
