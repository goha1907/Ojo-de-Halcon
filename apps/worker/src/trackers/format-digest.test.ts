import { describe, expect, it } from "vitest";
import { formatDigest } from "./format-digest";

describe("formatDigest", () => {
  it("shows the service, the latest stage and the status", () => {
    const text = formatDigest(
      {
        kind: "PJN",
        section: "citizenship_court",
        caseId: "CNE 007900/2026",
        header: { sit_actual: "GIRO" },
        step: { date: "3/09/2026", title: "PASE", detail: "FISCALIA" },
      },
      "ru",
    );
    expect(text.split("\n").slice(0, 2)).toEqual(["Дело CNE 007900/2026", expect.stringContaining("PJN")]);
    expect(text).toContain("• 3/09/2026 · PASE — FISCALIA");
    expect(text).toContain("GIRO");
  });

  it("adds the person name and handles a case without stages", () => {
    const text = formatDigest(
      { kind: "RENAPER", section: "dni_production", caseId: "755824304", header: {}, step: null },
      "es",
    );
    expect(text).toContain("755824304");
    expect(text).toContain("Todavía no hay etapas");
  });
});
