"use client";

import { API_ROUTES } from "@ojo/shared";
import { Modal } from "@ojo/ui";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { Markdown } from "@/components/news/markdown";

export interface NewsListItem {
  slug: string;
  date: string;
  time: string;
  title: string;
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
  | { title: string; date: string; time: string; body: string; newer: Neighbour | null; older: Neighbour | null }
  | "loading"
  | "error"
  | null;

/** Titles only, a few per page, paged in place; an entry opens in a modal. Scales to any number of news. */
export function NewsFeed({ initial }: { initial: Page }) {
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

  return (
    <div className="space-y-4">
      {data.items.length === 0 ? (
        <p className="text-sm text-fg-muted">{t("landing.news.empty")}</p>
      ) : (
        <ul className={`divide-y divide-line rounded-2xl border border-line bg-surface ${busy ? "opacity-60" : ""}`}>
          {data.items.map((item) => (
            <li key={item.slug}>
              <button
                type="button"
                onClick={() => void open(item.slug)}
                className="flex w-full items-baseline gap-4 px-5 py-3.5 text-left hover:bg-line/40"
              >
                <time dateTime={`${item.date}T${item.time}`} className="shrink-0 text-xs text-fg-muted">
                  {item.date} {item.time}
                </time>
                <span className="font-medium text-fg">{item.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={busy || data.page <= 1}
            onClick={() => void load(data.page - 1)}
            className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40"
          >
            ← {t("landing.news.newer")}
          </button>
          <span className="text-fg-muted">
            {t("landing.news.page", { page: data.page, pages: data.pages })}
          </span>
          <button
            type="button"
            disabled={busy || data.page >= data.pages}
            onClick={() => void load(data.page + 1)}
            className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40"
          >
            {t("landing.news.older")} →
          </button>
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
            <div className="max-h-[55vh] overflow-y-auto">
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
                    className="rounded-lg border border-line px-3 py-2 text-left text-sm hover:bg-line/40"
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
                    className="rounded-lg border border-line px-3 py-2 text-right text-sm hover:bg-line/40"
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
