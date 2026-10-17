/** Sorting and paging for short lists that are read whole (statuses, news): same address parameters as the others. */
export function sortAndPage<T>(
  rows: T[],
  options: { sort: string | undefined; dir: string | undefined; page: number; pageSize: number },
  columns: Record<string, (row: T) => string | number>,
  fallback: { sort: string; dir: "asc" | "desc" },
): { items: T[]; total: number; page: number; pageSize: number } {
  const sort = options.sort && columns[options.sort] ? options.sort : fallback.sort;
  const sign = (options.dir === "asc" || options.dir === "desc" ? options.dir : fallback.dir) === "asc" ? 1 : -1;
  const value = columns[sort]!;
  const sorted = [...rows].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    return sign * (typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right)));
  });
  const pages = Math.max(1, Math.ceil(sorted.length / options.pageSize));
  const page = Math.min(Math.max(1, options.page), pages);
  return { items: sorted.slice((page - 1) * options.pageSize, page * options.pageSize), total: sorted.length, page, pageSize: options.pageSize };
}
