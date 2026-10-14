import { describe, expect, it } from "vitest";
import {
  CORREO_FORMS,
  CORREO_FORM_KEYS,
  addTrackerSchema,
  correoDisplay,
  correoReference,
  normalizeCorreoReference,
  parseCorreoReference,
} from "../index";

describe("correoReference", () => {
  it("builds a coded reference with the chosen prefix", () => {
    expect(correoReference({ form: "ondnp", producto: "su", number: "123 456 789" })).toEqual({
      ok: true,
      reference: "ondnp:SU:123456789",
    });
  });

  it("requires a known prefix of that form and 7–9 digits", () => {
    expect(correoReference({ form: "ondnp", producto: "CC", number: "1234567" })).toMatchObject({
      ok: false,
      issue: { field: "producto" },
    });
    expect(correoReference({ form: "ondnc", producto: "CC", number: "123456" })).toMatchObject({
      ok: false,
      issue: { field: "number" },
    });
    expect(correoReference({ form: "ondnc", producto: "CC", number: "1234567890" }).ok).toBe(false);
  });

  it("checks the international shape of an inbound code", () => {
    expect(correoReference({ form: "oidn", number: "ab123456789cd" })).toEqual({
      ok: true,
      reference: "oidn:AB123456789CD",
    });
    expect(correoReference({ form: "oidn", number: "123456789" }).ok).toBe(false);
  });

  it("keeps the DNI reference as plain digits and prefixes the passport", () => {
    expect(correoReference({ form: "ondng", number: "755-824-304" })).toEqual({ ok: true, reference: "755824304" });
    expect(correoReference({ form: "onpa", number: "755824304" })).toEqual({ ok: true, reference: "onpa:755824304" });
    expect(correoReference({ form: "ondng", number: "12" }).ok).toBe(false);
  });

  it("accepts alphanumeric parcel numbers up to the site's limit", () => {
    expect(correoReference({ form: "mercadolibre", number: "ABC123xyz" }).ok).toBe(true);
    expect(correoReference({ form: "mercadolibre", number: "A".repeat(24) }).ok).toBe(false);
    expect(correoReference({ form: "ecommerce", number: "A".repeat(40) }).ok).toBe(true);
    expect(correoReference({ form: "ecommerce", number: "AB-12" }).ok).toBe(false);
  });
});

describe("correo references", () => {
  it("round-trips every form", () => {
    for (const form of CORREO_FORM_KEYS) {
      const def = CORREO_FORMS[form];
      const sample =
        def.layout === "coded"
          ? { form, producto: def.products[0], number: "1234567" }
          : def.layout === "upu"
            ? { form, number: "AB123456789CD" }
            : { form, number: "755824304" };
      const built = correoReference(sample);
      if (!built.ok) throw new Error(form);
      expect(parseCorreoReference(built.reference)?.form).toBe(form);
      expect(normalizeCorreoReference(built.reference)).toBe(built.reference);
    }
  });

  it("reads plain digits as a DNI trámite and rejects garbage", () => {
    expect(parseCorreoReference("755824304")).toEqual({ form: "ondng", id: "755824304" });
    expect(parseCorreoReference("nope:1")).toBeNull();
    expect(normalizeCorreoReference("ondnp:ZZ:1234567")).toBeNull();
  });

  it("shows a short human code", () => {
    expect(correoDisplay("ondnp:CU:123456789")).toBe("CU 123456789");
    expect(correoDisplay("oidn:AB123456789CD")).toBe("AB123456789CD");
    expect(correoDisplay("755824304")).toBe("755824304");
  });
});

describe("addTrackerSchema for Correo", () => {
  it("accepts plain digits and composite references, rejects the rest", () => {
    expect(addTrackerSchema.parse({ kind: "CORREO", number: " 755 824 304 " })).toEqual({
      kind: "CORREO",
      number: "755824304",
    });
    expect(addTrackerSchema.parse({ kind: "CORREO", number: "ondnp:cu:123456789" })).toEqual({
      kind: "CORREO",
      number: "ondnp:CU:123456789",
    });
    expect(addTrackerSchema.safeParse({ kind: "CORREO", number: "ondnp:CU:1" }).success).toBe(false);
  });
});
