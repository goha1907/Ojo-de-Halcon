"use client";

import { API_ROUTES, APP_CONFIG } from "@ojo/shared";
import { Modal } from "@ojo/ui";
import Image from "next/image";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { Markdown } from "@/components/news/markdown";

export interface NewsListItem {
  slug: string;
  date: string;
  time: string;
  title: string;
  summary: string;
  image: string;
}

interface Page {
  items: NewsListItem[];
  page: number;
  pages: number;
}

interface Neighbour {
  slug: string;
  title: string;
}

type Opened =
  | {
      title: string;
      date: string;
      time: string;
      image: string;
      body: string;
      newer: Neighbour | null;
      older: Neighbour | null;
    }
  | "loading"
  | "error"
  | null;

/** Height of one row of the list, in rem. */
const ROW_REM = 4.5;

/**
 * The newest entry as a big card with its picture on the left, the rest as a paged list of titles on the right;
 * an entry opens in a modal. Scales to any number of news.
 */
export function NewsFeed({ featured, initial }: { featured: NewsListItem | null; initial: Page }) {
  const t = useT();
  const [data, setData] = useState<Page>(initial);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<Opened>(null);

  async function load(page: number) {
    setBusy(true);
    try {
      const response = await fetch(`${API_ROUTES.news}?page=${page}`);
      if (response.ok) setData((await response.json()) as Page);
    } finally {
      setBusy(false);
    }
  }

  async function open(slug: string) {
    setOpened("loading");
    try {
      const response = await fetch(`${API_ROUTES.news}/${slug}`);
      if (!response.ok) throw new Error("failed");
      setOpened((await response.json()) as Opened);
    } catch {
      setOpened("error");
    }
  }

  const entry = opened !== null && opened !== "loading" && opened !== "error" ? opened : null;
  const cover = (src: string, priority = false) => (
    <Image src={src} alt="" width={1200} height={630} unoptimized priority={priority} className="aspect-[1200/630] w-full object-cover" />
  );

  return (
    <div className="space-y-4">
      {!featured && data.items.length === 0 ? (
        <p className="text-sm text-fg-muted">{t("landing.news.empty")}</p>
      ) : (
        <div className={featured ? "grid gap-x-6 gap-y-4 lg:grid-cols-[1.15fr_1fr]" : ""}>
          {featured && (
            <button
              type="button"
              onClick={() => void open(featured.slug)}
              className="group block self-stretch overflow-hidden rounded-card border border-line bg-surface text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:border-fg-subtle hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="block overflow-hidden">{cover(featured.image)}</span>
              <span className="block space-y-2 p-6">
                <time dateTime={`${featured.date}T${featured.time}`} className="block text-xs text-fg-muted">
                  {featured.date} {featured.time}
                </time>
                <span className="block text-2xl font-bold tracking-tight text-fg">{featured.title}</span>
                {featured.summary && <span className="block text-sm leading-6 text-fg-muted">{featured.summary}</span>}
              </span>
            </button>
          )}
          {/*
            Separate cards on a transparent ground. The list has a fixed number of equal slots, as tall as the big
            card beside it, and fills them from the top: a short last page leaves the slots empty, nothing stretches.
          */}
          <ul
            style={{ gridTemplateRows: `repeat(${APP_CONFIG.news.pageSize}, minmax(${ROW_REM}rem, 1fr))` }}
            className={`grid min-h-0 gap-3 ${busy ? "opacity-60" : ""}`}
          >
            {data.items.map((item) => (
              <li key={item.slug} className="min-h-0">
                <button
                  type="button"
                  onClick={() => void open(item.slug)}
                  className="grid size-full grid-cols-[7.75rem_1fr] items-center gap-4 rounded-card border border-line bg-surface px-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-fg-subtle hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <time dateTime={`${item.date}T${item.time}`} className="text-xs text-fg-muted">
                    {item.date} {item.time}
                  </time>
                  <span className="line-clamp-2 font-semibold leading-snug text-fg">{item.title}</span>
                </button>
              </li>
            ))}
          </ul>
          {data.pages > 1 && (
            <div className={`flex items-center justify-between text-sm ${featured ? "lg:col-start-2" : ""}`}>
              <button
                type="button"
                disabled={busy || data.page <= 1}
                onClick={() => void load(data.page - 1)}
                className="h-10 rounded-full border border-line px-4 transition-colors hover:bg-line/40 disabled:opacity-40"
              >
                ← {t("landing.news.newer")}
              </button>
              <span className="text-fg-muted">{t("landing.news.page", { page: data.page, pages: data.pages })}</span>
              <button
                type="button"
                disabled={busy || data.page >= data.pages}
                onClick={() => void load(data.page + 1)}
                className="h-10 rounded-full border border-line px-4 transition-colors hover:bg-line/40 disabled:opacity-40"
              >
                {t("landing.news.older")} →
              </button>
            </div>
          )}
        </div>
      )}
      <Modal
        open={opened !== null}
        onClose={() => setOpened(null)}
        title={entry?.title ?? t("landing.news.title")}
        closeLabel={t("landing.news.close")}
        className="w-[min(40rem,calc(100vw-2rem))]"
      >
        {opened === "loading" && <p className="text-sm text-fg-muted">{t("landing.news.loading")}</p>}
        {opened === "error" && <p className="text-sm text-error-fg">{t("landing.news.error")}</p>}
        {entry && (
          <div className="space-y-4">
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              <span className="block overflow-hidden rounded-field border border-line">{cover(entry.image)}</span>
              <time className="text-xs text-fg-muted" dateTime={`${entry.date}T${entry.time}`}>
                {entry.date} {entry.time}
              </time>
              <Markdown>{entry.body}</Markdown>
            </div>
            {(entry.newer || entry.older) && (
              <div className="grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
                {entry.newer ? (
                  <button
                    type="button"
                    onClick={() => void open(entry.newer!.slug)}
                    className="rounded-field border border-line px-3 py-2 text-left text-sm hover:bg-line/40"
                  >
                    <span className="block text-xs text-fg-muted">← {t("landing.news.newerEntry")}</span>
                    <span className="block truncate font-medium text-fg">{entry.newer.title}</span>
                  </button>
                ) : (
                  <span />
                )}
                {entry.older ? (
                  <button
                    type="button"
                    onClick={() => void open(entry.older!.slug)}
                    className="rounded-field border border-line px-3 py-2 text-right text-sm hover:bg-line/40"
                  >
                    <span className="block text-xs text-fg-muted">{t("landing.news.olderEntry")} →</span>
                    <span className="block truncate font-medium text-fg">{entry.older.title}</span>
                  </button>
                ) : (
                  <span />
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
