import { describe, expect, it } from "vitest";
import { sortAndPage } from "./memory-list";

const rows = [{ n: "b", c: 2 }, { n: "a", c: 10 }, { n: "c", c: 1 }];
const columns = { n: (row: (typeof rows)[number]) => row.n, c: (row: (typeof rows)[number]) => row.c };

describe("sortAndPage", () => {
  it("sorts text and numbers in both directions", () => {
    expect(sortAndPage(rows, { sort: "n", dir: "asc", page: 1, pageSize: 10 }, columns, { sort: "n", dir: "asc" }).items.map((r) => r.n)).toEqual(["a", "b", "c"]);
    expect(sortAndPage(rows, { sort: "c", dir: "desc", page: 1, pageSize: 10 }, columns, { sort: "n", dir: "asc" }).items.map((r) => r.c)).toEqual([10, 2, 1]);
  });

  it("falls back on an unknown column and clamps the page", () => {
    const result = sortAndPage(rows, { sort: "x", dir: undefined, page: 99, pageSize: 2 }, columns, { sort: "n", dir: "asc" });
    expect(result).toMatchObject({ page: 2, total: 3 });
    expect(result.items.map((r) => r.n)).toEqual(["c"]);
  });
});
