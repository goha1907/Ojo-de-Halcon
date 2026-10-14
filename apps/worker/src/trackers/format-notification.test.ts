import { describe, expect, it } from "vitest";
import { formatNotification } from "./format-notification";

describe("formatNotification", () => {
  it("lists new stages and the current status in the user's language", () => {
    const text = formatNotification({
      kind: "PJN",
      locale: "ru",
      caseId: "CNE 007900/2026",
      payload: {
        step: { date: "3/09/2026", title: "DESPACHO", detail: "TRASLADO" },
        header: { sit_actual: "GIRO" },
      },
    });
    expect(text.split("\n").slice(0, 2)).toEqual(["Дело CNE 007900/2026", expect.stringContaining("PJN")]);
    expect(text).toContain("• 3/09/2026 · DESPACHO — TRASLADO");
    expect(text).toContain("GIRO");
  });

  it("falls back to the default locale and the generic owner label", () => {
    const text = formatNotification({
      kind: "CORREO",
      locale: "xx",
      caseId: "755824304",
      payload: { step: null, header: {} },
    });
    expect(text.startsWith("Отслеживание № 755824304")).toBe(true);
  });
});
