import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { APP_CONFIG, LOCALES, type Locale } from "@ojo/shared";

export interface NewsItem {
  /** `YYYY-MM-DD-name`, also the URL segment. */
  slug: string;
  /** ISO date taken from the file name. */
  date: string;
  title: string;
  summary: string;
  /** Markdown body. */
  body: string;
  locale: Locale;
}

const NEWS_DIR = path.join(process.cwd(), "content", "news");
const FILE_PATTERN = /^(\d{4}-\d{2}-\d{2})-([a-z0-9-]+)\.([a-z]{2})\.md$/;
const SLUG_PATTERN = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;

/** Splits `---\nkey: value\n---\nbody` (flat keys only) into meta and body. */
export function parseFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    meta[line.slice(0, separator).trim()] = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return { meta, body: match[2]!.trim() };
}

export function parseNewsFilename(
  filename: string,
): { slug: string; date: string; locale: Locale } | null {
  const match = FILE_PATTERN.exec(filename);
  if (!match) return null;
  const [, date, name, locale] = match;
  if (!(LOCALES as readonly string[]).includes(locale!)) return null;
  return { slug: `${date}-${name}`, date: date!, locale: locale as Locale };
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
  return [...bySlug.values()].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

async function readAll(): Promise<NewsItem[]> {
  let files: string[];
  try {
    files = await readdir(NEWS_DIR);
  } catch {
    return [];
  }
  const items: NewsItem[] = [];
  for (const file of files) {
    const info = parseNewsFilename(file);
    if (!info) continue;
    const { meta, body } = parseFrontmatter(await readFile(path.join(NEWS_DIR, file), "utf8"));
    items.push({ ...info, title: meta.title ?? info.slug, summary: meta.summary ?? "", body });
  }
  return items;
}

export async function listNews(locale: Locale): Promise<NewsItem[]> {
  return pickLocale(await readAll(), locale);
}

export async function getNews(slug: string, locale: Locale): Promise<NewsItem | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  return (await listNews(locale)).find((item) => item.slug === slug) ?? null;
}
