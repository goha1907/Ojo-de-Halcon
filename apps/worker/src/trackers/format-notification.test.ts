import { describe, expect, it } from "vitest";
import { formatNotification, notificationButton } from "./format-notification";

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
    expect(text.split("\n").slice(0, 2)).toEqual(["🔔 CIUDADANÍA · PJN", "Дело CNE 007900/2026"]);
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
    expect(text.split("\n").slice(0, 2)).toEqual(["🔔 ДОСТАВКА · CORREO ARGENTINO", "Отслеживание № 755824304"]);
  });

  it("puts the user's own name between the service and the number", () => {
    const text = formatNotification({
      kind: "RENAPER",
      locale: "ru",
      caseId: "755824304",
      label: "  Паспорт мамы ",
      payload: { step: { date: "16/10/2026 10:06", title: "Embalado", detail: "" }, header: { status: "EN PROCESO" }, initial: true },
    });
    expect(text.split("\n")).toEqual([
      "🆕 DNI · RENAPER",
      "«Паспорт мамы»",
      "Отслеживание № 755824304",
      "Отслеживание добавлено, текущее состояние",
      "• 16/10/2026 10:06 · Embalado",
      "Статус: EN PROCESO",
    ]);
  });
});

describe("notificationButton", () => {
  it("links to the page of the case's service in the user's language", () => {
    expect(notificationButton({ kind: "RENAPER", locale: "en" }, "https://ojo.example/")).toEqual({
      text: expect.any(String),
      url: "https://ojo.example/services/dni/renaper",
    });
    expect(notificationButton({ kind: "PJN", locale: "ru" }, "https://ojo.example")?.url).toBe("https://ojo.example/services/citizenship/tribunal");
  });

  it("gives no button without a public site address", () => {
    expect(notificationButton({ kind: "RENAPER", locale: "ru" }, null)).toBeUndefined();
    expect(notificationButton({ kind: "RENAPER", locale: "ru" }, undefined)).toBeUndefined();
  });
});
