import { describe, expect, it } from "vitest";
import { formatNotification } from "./format-notification";

describe("formatNotification", () => {
  it("lists new stages and the current status in the user's language", () => {
    const text = formatNotification({
      kind: "PJN",
      locale: "ru",
      label: null,
      payload: {
        newSteps: [{ date: "3/09/2026", title: "DESPACHO", detail: "TRASLADO" }],
        header: { sit_actual: "GIRO" },
      },
    });
    expect(text).toContain("Суд");
    expect(text).toContain("• 3/09/2026 · DESPACHO — TRASLADO");
    expect(text).toContain("GIRO");
  });

  it("falls back to the default locale and shows the label", () => {
    const text = formatNotification({
      kind: "CORREO",
      locale: "xx",
      label: "Мама",
      payload: { newSteps: [], header: {} },
    });
    expect(text).toContain("Мама");
  });
});
