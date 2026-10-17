import { describe, expect, it } from "vitest";
import {
  addTrackerSchema,
  parsePjnReference,
  pjnReference,
  sectionHref,
} from "../index";

describe("pjn references", () => {
  it("round-trips", () => {
    const reference = pjnReference({ jurisdiction: "4", number: "7900", year: "2026" });
    expect(parsePjnReference(reference)).toEqual({ jurisdiction: "4", number: "7900", year: "2026" });
  });

});

describe("addTrackerSchema", () => {
  it("normalizes the trámite number", () => {
    const parsed = addTrackerSchema.parse({ kind: "RENAPER", number: " 755 824-304 " });
    expect(parsed).toEqual({ kind: "RENAPER", number: "755824304" });
  });

  it("rejects short numbers and unknown courts", () => {
    expect(addTrackerSchema.safeParse({ kind: "CORREO", number: "12" }).success).toBe(false);
    expect(
      addTrackerSchema.safeParse({ kind: "PJN", jurisdiction: "99", number: "1", year: "2026" }).success,
    ).toBe(false);
  });

  it("accepts a court case and strips leading zeros", () => {
    const parsed = addTrackerSchema.parse({ kind: "PJN", jurisdiction: "4", number: "007900", year: "2026" });
    expect(parsed).toMatchObject({ number: "7900", year: "2026" });
  });
});

describe("sectionHref", () => {
  it("links sections to their pages", () => {
    expect(sectionHref("dni_production")).toBe("/services/dni/renaper");
    expect(sectionHref("citizenship_court")).toBe("/services/citizenship/tribunal");
  });
});
