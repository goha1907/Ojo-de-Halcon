import { describe, expect, it } from "vitest";
import { addTrackerSchema, canUseEarlyAccess, isEarlyAccessKind, isManualKind, parseOcasaText } from "../index";

const NOW = new Date("2026-10-17T12:00:00Z");

// What "select all, copy" gives on OCASA's tracking page (name and address are made up).
const PAGE = `OCASA
INGRESÁ EL NÚMERO DE SEGUIMIENTO
Estado de mi pedido
000123456789
Tracking Number
Despachado a sucursal
16/OCT - 17:18 hs.
El envío ha salido del centro de distribución de OCASA (A042 - Argentina).
Pedido en centro
16/OCT - 10:06 hs.
El envío ha llegado al centro de distribución OCASA (Iriarte - AR).
Confirmado
16/OCT - 10:06 hs.
El envío está confirmado para iniciar el proceso de distribución.
Ver menos
Referencias de ubicación
Origen
REGISTRO NACIONAL DE LAS PERSONAS
Destino
JUAN PEREZ
Mi dirección
CALLE FALSA 123
`;

describe("parseOcasaText", () => {
  it("reads the number and the stages, oldest first, and drops everything else", () => {
    const page = parseOcasaText(PAGE, NOW);
    expect(page.number).toBe("000123456789");
    expect(page.steps).toEqual([
      { date: "2026-10-16 10:06", title: "Confirmado", detail: "El envío está confirmado para iniciar el proceso de distribución." },
      { date: "2026-10-16 10:06", title: "Pedido en centro", detail: "El envío ha llegado al centro de distribución OCASA (Iriarte - AR)." },
      { date: "2026-10-16 17:18", title: "Despachado a sucursal", detail: "El envío ha salido del centro de distribución de OCASA (A042 - Argentina)." },
    ]);
    // nothing personal survives
    expect(JSON.stringify(page)).not.toMatch(/PEREZ|FALSA/);
  });

  it("puts a date that would be in the future into the previous year", () => {
    const page = parseOcasaText("Entregado\n30/DIC - 09:00 hs.\nEntregado al destinatario.", NOW);
    expect(page.steps[0]!.date).toBe("2025-12-30 09:00");
  });

  it("returns no stages for text that is not the page", () => {
    expect(parseOcasaText("hola, esto no es la página", NOW)).toEqual({ number: null, steps: [] });
    expect(parseOcasaText("", NOW).steps).toEqual([]);
  });
});

describe("OCASA numbers and access", () => {
  it("pads the trámite number to 12 digits", () => {
    expect(addTrackerSchema.parse({ kind: "OCASA", number: "755 824 304" })).toEqual({ kind: "OCASA", number: "000755824304" });
    expect(addTrackerSchema.safeParse({ kind: "OCASA", number: "12" }).success).toBe(false);
  });

  it("is a manual source; the early-access rule lets staff and flagged accounts through", () => {
    expect(isManualKind("OCASA")).toBe(true);
    expect(isManualKind("RENAPER")).toBe(false);
    // parked: hidden from ordinary accounts; a list can be given to change that
    expect(isEarlyAccessKind("OCASA")).toBe(true);
    expect(isEarlyAccessKind("OCASA", [])).toBe(false);
    expect(canUseEarlyAccess({ role: "USER", earlyAccess: false })).toBe(false);
    expect(canUseEarlyAccess({ role: "USER", earlyAccess: true })).toBe(true);
    expect(canUseEarlyAccess({ role: "SUPPORT", earlyAccess: false })).toBe(true);
  });
});
