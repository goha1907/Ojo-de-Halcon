import { firstEnabledIndex, lastEnabledIndex, matchPrefix, nextEnabledIndex, type SelectOption } from "@ojo/ui";
import { describe, expect, it } from "vitest";

const options: SelectOption[] = [
  { value: "a", label: "Alfa" },
  { value: "b", label: "Bravo", disabled: true },
  { value: "c", label: "Charlie" },
  { value: "d", label: "Delta" },
  { value: "e", label: "Echo", disabled: true },
];

describe("select navigation", () => {
  it("skips disabled options and stops at the edges", () => {
    expect(nextEnabledIndex(options, 0, 1)).toBe(2);
    expect(nextEnabledIndex(options, 2, -1)).toBe(0);
    expect(nextEnabledIndex(options, 3, 1)).toBe(3);
    expect(nextEnabledIndex(options, 0, -1)).toBe(0);
  });

  it("finds the first and last enabled option", () => {
    expect(firstEnabledIndex(options)).toBe(0);
    expect(lastEnabledIndex(options)).toBe(3);
    expect(firstEnabledIndex([{ value: "x", label: "X", disabled: true }])).toBe(-1);
    expect(lastEnabledIndex([])).toBe(-1);
  });
});

describe("select type-ahead", () => {
  const words: SelectOption[] = [
    { value: "1", label: "Córdoba" },
    { value: "2", label: "Chaco" },
    { value: "3", label: "Chubut" },
    { value: "4", label: "Salta", disabled: true },
    { value: "5", label: "Santa Fe" },
  ];

  it("matches the label start, ignoring case, and wraps around", () => {
    expect(matchPrefix(words, "ch", 0)).toBe(1);
    expect(matchPrefix(words, "CH", 1)).toBe(2);
    expect(matchPrefix(words, "ch", 2)).toBe(1);
  });

  it("ignores disabled options and reports no match", () => {
    expect(matchPrefix(words, "sa", 0)).toBe(4);
    expect(matchPrefix(words, "x", 0)).toBe(-1);
    expect(matchPrefix(words, "", 0)).toBe(-1);
  });

  it("a longer word can still match the option it started on", () => {
    expect(matchPrefix(words, "chu", 1 - 1)).toBe(2);
    expect(matchPrefix(words, "cha", 1 - 1)).toBe(1);
  });
});
