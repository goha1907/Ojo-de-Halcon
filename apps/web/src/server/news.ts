import { statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { APP_CONFIG, DEFAULT_NEWS_COVER, LOCALES, NEWS_COVER_PATTERN, type Locale } from "@ojo/shared";
import { getCore } from "./core";

export interface NewsItem {
  /** `YYYY-MM-DD-name`, also the URL segment. */
  slug: string;
  /** ISO date of the entry (the start of the slug). */
  date: string;
  /** `HH:MM` of the entry: orders entries of one day. */
  time: string;
  title: string;
  summary: string;
  /** Markdown body. */
  body: string;
  /** Cover: a picture from `public/news` or an uploaded one; entries without one use the default (see `coverOf`). */
  image?: string | undefined;
  /** The main news: the big card on the home page (set in the admin area; only one entry has it). */
  featured?: boolean;
  locale: Locale;
}

const SLUG_PATTERN = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;

export const DEFAULT_COVER = DEFAULT_NEWS_COVER;

const coverVersions = new Map<string, string>();

/**
 * The address of a cover. A built-in picture gets its change time as a version, so a redrawn one is never served
 * from a browser cache; an uploaded picture has a new address every time, so it needs none.
 */
function versioned(cover: string): string {
  if (!cover.startsWith("/news/")) return cover;
  let version = coverVersions.get(cover);
  if (version === undefined) {
    try {
      version = String(Math.trunc(statSync(path.join(process.cwd(), "public", cover)).mtimeMs));
    } catch {
      version = "";
    }
    coverVersions.set(cover, version);
  }
  return version ? `${cover}?v=${version}` : cover;
}

export function coverOf(item: Pick<NewsItem, "image">): string {
  return versioned(item.image ?? DEFAULT_COVER);
}

/** Picks the requested locale for each slug, falling back to the default one. */
export function pickLocale(items: NewsItem[], locale: Locale): NewsItem[] {
  const bySlug = new Map<string, NewsItem>();
  for (const item of items) {
    const current = bySlug.get(item.slug);
    const better =
      !current ||
      item.locale === locale ||
      (current.locale !== locale && item.locale === APP_CONFIG.defaultLocale);
    if (better) bySlug.set(item.slug, item);
  }
  // newest first: by date and time, then by name so the order is always the same
  return [...bySlug.values()].sort(
    (a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`) || a.slug.localeCompare(b.slug),
  );
}

/** Every entry in the database, one item per language. */
async function readAll(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  for (const row of await getCore().admin.publishedNews()) {
    if (!(LOCALES as readonly string[]).includes(row.locale)) continue;
    items.push({
      slug: row.slug,
      date: row.date,
      time: row.time,
      title: row.title,
      summary: row.summary,
      body: row.body,
      locale: row.locale as Locale,
      image: row.image && NEWS_COVER_PATTERN.test(row.image) ? row.image : undefined,
      featured: row.featured,
    });
  }
  return items;
}

/** Built-in cover files the admin area can choose from (`public/news`, without the default one). */
export async function listCovers(): Promise<string[]> {
  try {
    const files = await readdir(path.join(process.cwd(), "public", "news"));
    return files
      .map((file) => `/news/${file}`)
      .filter((cover) => NEWS_COVER_PATTERN.test(cover) && cover !== DEFAULT_COVER)
      .sort();
  } catch {
    return [];
  }
}

export async function listNews(locale: Locale): Promise<NewsItem[]> {
  return pickLocale(await readAll(), locale);
}

export async function getNews(slug: string, locale: Locale): Promise<NewsItem | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  return (await listNews(locale)).find((item) => item.slug === slug) ?? null;
}

export interface NewsWithNeighbours {
  item: NewsItem;
  /** The next newer entry, if any. */
  newer: Pick<NewsItem, "slug" | "title"> | null;
  /** The next older entry, if any. */
  older: Pick<NewsItem, "slug" | "title"> | null;
}

/** One entry together with its neighbours in the newest-first list. */
export async function getNewsWithNeighbours(slug: string, locale: Locale): Promise<NewsWithNeighbours | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  const all = await listNews(locale);
  const index = all.findIndex((item) => item.slug === slug);
  if (index === -1) return null;
  const pick = (entry: NewsItem | undefined) => (entry ? { slug: entry.slug, title: entry.title } : null);
  return { item: all[index]!, newer: pick(all[index - 1]), older: pick(all[index + 1]) };
}

export interface NewsPage {
  /** Entries without the body: the list only needs titles. */
  items: Array<Pick<NewsItem, "slug" | "date" | "time" | "title" | "summary"> & { image: string }>;
  page: number;
  pages: number;
}

const summarize = (item: NewsItem): NewsPage["items"][number] => ({
  slug: item.slug,
  date: item.date,
  time: item.time,
  title: item.title,
  summary: item.summary,
  image: coverOf(item),
});

/** The main news (the one marked in the admin area), or the newest entry when none is marked; null without news. */
export async function getFeaturedNews(locale: Locale): Promise<NewsPage["items"][number] | null> {
  const all = await listNews(locale);
  const item = all.find((entry) => entry.featured) ?? all[0];
  return item ? summarize(item) : null;
}

/**
 * One page of the news list, newest first; an out-of-range page is clamped. `exclude` leaves one entry out
 * (the main news is shown separately).
 */
export async function listNewsPage(
  locale: Locale,
  page: number,
  pageSize: number,
  exclude?: string,
): Promise<NewsPage> {
  const all = (await listNews(locale)).filter((item) => item.slug !== exclude);
  const pages = Math.max(1, Math.ceil(all.length / pageSize));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  const items = all.slice((current - 1) * pageSize, current * pageSize).map(summarize);
  return { items, page: current, pages };
}
