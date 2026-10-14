import { describe, expect, it } from "vitest";
import { findMatches, fold, matchesAll, searchWords } from "./search";

describe("search", () => {
  it("ignores case, accents and ё", () => {
    expect(fold("Archívese")).toBe("archivese");
    expect(fold("ЁЛКА")).toBe("елка");
    expect(matchesAll("DNI Refugiado MDP Егор", searchWords("  refugiado  егор "))).toBe(true);
  });

  it("needs every word, in any order", () => {
    expect(matchesAll("Мама · RENAPER · Embalado", searchWords("embalado мама"))).toBe(true);
    expect(matchesAll("Мама · RENAPER", searchWords("мама resuelto"))).toBe(false);
    expect(matchesAll("anything", searchWords("   "))).toBe(true);
  });

  it("finds positions in the original text, accents included", () => {
    // "Verificación" folds to the same length, so offsets stay valid for highlighting
    expect(findMatches("Verificación aprobada", searchWords("ción"))).toEqual([[8, 12]]);
    expect(findMatches("ёж и ёж", searchWords("еж"))).toEqual([
      [0, 2],
      [5, 7],
    ]);
  });
});
