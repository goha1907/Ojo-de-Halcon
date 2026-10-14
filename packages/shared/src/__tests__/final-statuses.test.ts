import { describe, expect, it } from "vitest";
import { isFinalStatus } from "../config/final-statuses";

describe("final statuses", () => {
  it("ignores case, accents and spaces", () => {
    expect(isFinalStatus("DNM_DNI", " resuelto ")).toBe(true);
    expect(isFinalStatus("PJN", "Archívese")).toBe(true);
    expect(isFinalStatus("RENAPER", "EMBALADO")).toBe(true);
    expect(isFinalStatus("CORREO", "Entregado")).toBe(true);
  });

  it("does not end a case on other statuses or on a kind without known finals", () => {
    expect(isFinalStatus("DNM_DNI", "EN TRAMITE")).toBe(false);
    expect(isFinalStatus("RENAPER", "Verificado")).toBe(false);
    expect(isFinalStatus("DNM_CITIZENSHIP", "RESUELTO")).toBe(false);
    expect(isFinalStatus("PJN", undefined)).toBe(false);
  });
});
