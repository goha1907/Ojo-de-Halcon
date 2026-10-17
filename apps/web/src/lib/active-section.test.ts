import { describe, expect, it } from "vitest";
import { pickActiveSection } from "./active-section";

const sections = [
  { id: "how", top: 100, bottom: 500 },
  { id: "pricing", top: 700, bottom: 1200 },
  { id: "faq", top: 1400, bottom: 1900 },
];
const at = (scroll: number, line = 200) =>
  pickActiveSection(sections.map((s) => ({ ...s, top: s.top - scroll, bottom: s.bottom - scroll })), line);

describe("pickActiveSection", () => {
  it("is empty above the first section", () => {
    expect(at(-400)).toBeNull();
  });

  it("follows the section under the reading line", () => {
    expect(at(0)).toBe("how");
    expect(at(600)).toBe("pricing");
    expect(at(1300)).toBe("faq");
  });

  it("keeps the previous section lit in the gap before the next one", () => {
    expect(at(300)).toBe("how"); // how ended at 200 on screen, pricing starts at 400
  });

  it("goes empty once the last section is behind the line", () => {
    expect(at(1800)).toBeNull();
    expect(at(1600)).toBe("faq");
  });

  it("handles no sections", () => {
    expect(pickActiveSection([], 100)).toBeNull();
  });
});
