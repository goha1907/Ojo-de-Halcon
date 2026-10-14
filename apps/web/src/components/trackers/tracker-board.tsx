"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { highlightMatches, matchesAll, searchWords } from "@/lib/search";
import { SearchWordsProvider } from "./search-context";
import { StatusLegend } from "./status-legend";
import { toneOf, type StatusTone } from "@/lib/status-tones";

export type BoardStatus = "PENDING_CONFIRMATION" | "ACTIVE" | "FINISHED" | "PAUSED";

export interface BoardItem {
  id: string;
  /** The rendered card. */
  node: ReactNode;
  status: BoardStatus;
  /** false: marked for removal from the subscription at the next period. */
  kept: boolean;
  /** Name given by the user, or the official number. */
  name: string;
  number: string;
  /** Epoch ms of when it was added, and of its latest change at the source. */
  addedAt: number;
  changedAt: number;
  /** Everything the search looks through: name, number, statuses, stages, details. */
  search: string;
}

type Filter = "all" | "tracking" | "removing" | "finished" | "paused" | "pending";
type Sort = "addedDesc" | "addedAsc" | "nameAsc" | "nameDesc" | "changedDesc" | "changedAsc";

const FILTERS: Record<Exclude<Filter, "all">, (item: BoardItem) => boolean> = {
  tracking: (item) => item.status === "ACTIVE" && item.kept,
  removing: (item) => item.status === "ACTIVE" && !item.kept,
  finished: (item) => item.status === "FINISHED",
  paused: (item) => item.status === "PAUSED",
  pending: (item) => item.status === "PENDING_CONFIRMATION",
};

/**
 * Names are compared with the locale's collation, ignoring case and reading digits as numbers.
 * Mixed alphabets sort Latin before Cyrillic (A-Z, then А-Я); descending is the exact reverse.
 */
const collator = new Intl.Collator(["ru", "es", "en"], { sensitivity: "base", numeric: true });

const SORTS: Record<Sort, (a: BoardItem, b: BoardItem) => number> = {
  addedDesc: (a, b) => b.addedAt - a.addedAt,
  addedAsc: (a, b) => a.addedAt - b.addedAt,
  nameAsc: (a, b) => collator.compare(a.name, b.name) || a.addedAt - b.addedAt,
  nameDesc: (a, b) => collator.compare(b.name, a.name) || a.addedAt - b.addedAt,
  changedDesc: (a, b) => b.changedAt - a.changedAt || b.addedAt - a.addedAt,
  changedAsc: (a, b) => a.changedAt - b.changedAt || a.addedAt - b.addedAt,
};

const DEFAULT_CHOICE = { filter: "all" as Filter, sort: "addedDesc" as Sort };
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: { filter: Filter; sort: Sort } }>();

function readChoice(key: string): { filter: Filter; sort: Sort } {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    /* storage may be unavailable: the default applies */
  }
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.value;
  let value = DEFAULT_CHOICE;
  try {
    const saved = raw ? (JSON.parse(raw) as { filter: Filter; sort: Sort }) : null;
    if (saved && (saved.filter === "all" || saved.filter in FILTERS) && saved.sort in SORTS) value = saved;
  } catch {
    /* a broken value is ignored */
  }
  cache.set(key, { raw, value });
  return value;
}

/** The viewer's remembered filter and sort (a per-browser convenience), read without a hydration mismatch. */
function useChoice(key: string) {
  const subscribe = useCallback((notify: () => void) => {
    listeners.add(notify);
    window.addEventListener("storage", notify);
    return () => {
      listeners.delete(notify);
      window.removeEventListener("storage", notify);
    };
  }, []);
  const choice = useSyncExternalStore(
    subscribe,
    () => readChoice(key),
    () => DEFAULT_CHOICE,
  );
  const update = useCallback(
    (next: Partial<{ filter: Filter; sort: Sort }>) => {
      const merged = { ...readChoice(key), ...next };
      try {
        window.localStorage.setItem(key, JSON.stringify(merged));
      } catch {
        cache.set(key, { raw: null, value: merged });
      }
      listeners.forEach((notify) => notify());
    },
    [key],
  );
  return [choice, update] as const;
}

/** Cards of one section with filters (by state of the tracking) and sorting. */
export function TrackerBoard({ items, storageKey }: { items: BoardItem[]; storageKey: string }) {
  const t = useT();
  const [{ filter, sort }, choose] = useChoice(storageKey);
  const [query, setQuery] = useState("");
  const words = useMemo(() => searchWords(query), [query]);
  const list = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => {
    const result = { all: items.length } as Record<Filter, number>;
    for (const name of Object.keys(FILTERS) as Exclude<Filter, "all">[]) {
      result[name] = items.filter(FILTERS[name]).length;
    }
    return result;
  }, [items]);

  const shown = useMemo(() => {
    const byState = filter === "all" ? items : items.filter(FILTERS[filter]);
    const found = words.length === 0 ? byState : byState.filter((item) => matchesAll(item.search, words));
    return [...found].sort(SORTS[sort]);
  }, [items, filter, sort, words]);

  // mark the matches inside the visible cards (after the cards have opened)
  useEffect(() => {
    if (words.length === 0 || !list.current) return;
    return highlightMatches(list.current, words);
  }, [words, shown]);

  // a chosen filter stays selectable even when it has just become empty
  const visibleFilters = (["all", ...Object.keys(FILTERS)] as Filter[]).filter(
    (name) => name === "all" || name === filter || counts[name] > 0,
  );

  const legendTones: StatusTone[] = ["tracking", "removing", "finished", "paused", "pending"];
  const presentTones = new Set(items.map((item) => toneOf(item.status, item.kept)));
  const legend = legendTones
    // the three main states are always explained; the rare ones only when one is on the page
    .filter((tone) => ["tracking", "removing", "finished"].includes(tone) || presentTones.has(tone))
    .map((tone) => ({
      tone,
      label: t(`board.legend.${tone}` as never),
      hint: t(`board.legend.${tone}.hint` as never),
    }));

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <StatusLegend title={t("board.legend.title")} infoLabel={t("board.legend.info")} items={legend} />
      )}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("board.search.placeholder")}
            aria-label={t("board.search.label")}
            className="min-w-48 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-brand-600"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            {t("board.filter.label")}
            <select
              value={filter}
              onChange={(event) => choose({ filter: event.target.value as Filter })}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
            >
              {visibleFilters.map((name) => (
                <option key={name} value={name}>
                  {t(`board.filter.${name}` as never)} ({counts[name]})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            {t("board.sort.label")}
            <select
              value={sort}
              onChange={(event) => choose({ sort: event.target.value as Sort })}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
            >
              {(Object.keys(SORTS) as Sort[]).map((name) => (
                <option key={name} value={name}>
                  {t(`board.sort.${name}` as never)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          {words.length > 0 ? t("board.search.empty", { query: query.trim() }) : t("board.empty")}
        </p>
      ) : (
        <SearchWordsProvider value={words}>
          <div ref={list} className="space-y-4">
            {shown.map((item) => (
              <div key={item.id}>{item.node}</div>
            ))}
          </div>
        </SearchWordsProvider>
      )}
    </div>
  );
}
