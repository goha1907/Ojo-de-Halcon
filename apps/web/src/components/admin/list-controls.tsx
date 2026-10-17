import Link from "next/link";

/** Query parameters of a list page, flattened to plain strings. */
export type Params = Record<string, string | undefined>;

export function flatParams(raw: Record<string, string | string[] | undefined>): Params {
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
}

/** The address of a list page with some parameters changed (`undefined` or "" removes one). */
export function listHref(base: string, params: Params, change: Params = {}): string {
  const merged = { ...params, ...change };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) if (value) query.set(key, value);
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}

interface SortProps {
  label: string;
  field: string;
  base: string;
  params: Params;
  /** The column and direction a list uses when nothing is chosen. */
  defaultSort: string;
  defaultDir?: "asc" | "desc";
  /** Parameter names (a page can hold several lists, each with its own prefix). */
  keys?: { sort: string; dir: string; page: string };
  className?: string;
}

const PLAIN = { sort: "sort", dir: "dir", page: "page" };

/** A column title that sorts the list by that column; a second click reverses the order. */
export function SortTh({ label, field, base, params, defaultSort, defaultDir = "desc", keys = PLAIN, className = "" }: SortProps) {
  const sort = params[keys.sort] ?? defaultSort;
  const dir = params[keys.dir] === "asc" || params[keys.dir] === "desc" ? params[keys.dir]! : defaultDir;
  const active = sort === field;
  const next = active ? (dir === "asc" ? "desc" : "asc") : field === defaultSort ? defaultDir : "asc";
  return (
    <th className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted ${className}`} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={listHref(base, params, { [keys.sort]: field, [keys.dir]: next, [keys.page]: undefined })} className={`inline-flex items-center gap-1 hover:text-fg ${active ? "text-fg" : ""}`}>
        {label}
        <span aria-hidden="true" className="text-[10px]">{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </Link>
    </th>
  );
}

export interface FilterField {
  name: string;
  label: string;
  kind: "text" | "select" | "date";
  options?: { value: string; label: string }[];
  placeholder?: string;
}

const CONTROL = "w-full rounded-field border border-line bg-surface px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-2 focus-visible:outline-ring";

/**
 * Filters of a list as a plain GET form: the page stays a server page and every state is in the address.
 * Other parameters of the page (sorting, other lists) are kept; the page number is reset.
 */
export function FilterBar({ base, fields, params, pageKey = "page" }: { base: string; fields: FilterField[]; params: Params; pageKey?: string }) {
  const own = new Set(fields.map((field) => field.name));
  const kept = Object.entries(params).filter(([key, value]) => value && !own.has(key) && key !== pageKey);
  const active = fields.some((field) => params[field.name]);
  const cleared = Object.fromEntries(fields.map((field) => [field.name, undefined]));
  return (
    <form action={base} className="mb-4 rounded-field border border-line bg-surface p-3">
      {kept.map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((field) => (
          <label key={field.name} className="block space-y-1 text-xs font-medium text-fg-muted">
            {field.label}
            {field.kind === "select" ? (
              <select name={field.name} defaultValue={params[field.name] ?? ""} className={CONTROL}>
                <option value="">All</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            ) : (
              <input type={field.kind === "date" ? "date" : "search"} name={field.name} defaultValue={params[field.name] ?? ""} placeholder={field.placeholder} className={CONTROL} />
            )}
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button className="rounded-field bg-brand px-4 py-1.5 text-sm font-medium text-brand-fg hover:bg-brand-hover">Apply</button>
        {active && (
          <Link href={listHref(base, params, { ...cleared, [pageKey]: undefined })} className="rounded-field border border-line px-3 py-1.5 text-sm hover:bg-line/40">
            Reset
          </Link>
        )}
      </div>
    </form>
  );
}

/** Sorting for lists that are not tables (cards): a row of links, the active one shows the direction. */
export function SortLinks({ base, params, options, defaultSort }: { base: string; params: Params; options: { field: string; label: string }[]; defaultSort: string }) {
  const sort = params.sort ?? defaultSort;
  const dir = params.dir === "asc" || params.dir === "desc" ? params.dir : "desc";
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
      <span>Sort by:</span>
      {options.map((option) => {
        const active = sort === option.field;
        const next = active ? (dir === "asc" ? "desc" : "asc") : option.field === defaultSort ? "desc" : "asc";
        return (
          <Link
            key={option.field}
            href={listHref(base, params, { sort: option.field, dir: next, page: undefined })}
            className={`rounded-field border px-2.5 py-1 ${active ? "border-brand text-fg" : "border-line hover:bg-line/40"}`}
          >
            {option.label}
            {active ? (dir === "asc" ? " ▲" : " ▼") : ""}
          </Link>
        );
      })}
    </div>
  );
}
