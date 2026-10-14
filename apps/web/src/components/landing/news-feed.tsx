"use client";

import { API_ROUTES } from "@ojo/shared";
import { Modal } from "@ojo/ui";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { Markdown } from "@/components/news/markdown";

export interface NewsListItem {
  slug: string;
  date: string;
  title: string;
}

interface Page {
  items: NewsListItem[];
  page: number;
  pages: number;
}

type Opened = { title: string; date: string; body: string } | "loading" | "error" | null;

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
        <p className="text-sm text-slate-600">{t("landing.news.empty")}</p>
      ) : (
        <ul className={`divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white ${busy ? "opacity-60" : ""}`}>
          {data.items.map((item) => (
            <li key={item.slug}>
              <button
                type="button"
                onClick={() => void open(item.slug)}
                className="flex w-full items-baseline gap-4 px-5 py-3.5 text-left hover:bg-slate-50"
              >
                <time dateTime={item.date} className="shrink-0 text-xs text-slate-500">
                  {item.date}
                </time>
                <span className="font-medium text-slate-900">{item.title}</span>
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
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            ← {t("landing.news.newer")}
          </button>
          <span className="text-slate-500">
            {t("landing.news.page", { page: data.page, pages: data.pages })}
          </span>
          <button
            type="button"
            disabled={busy || data.page >= data.pages}
            onClick={() => void load(data.page + 1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
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
        {opened === "loading" && <p className="text-sm text-slate-500">{t("landing.news.loading")}</p>}
        {opened === "error" && <p className="text-sm text-red-600">{t("landing.news.error")}</p>}
        {entry && (
          <div className="max-h-[60vh] overflow-y-auto">
            <time className="text-xs text-slate-500" dateTime={entry.date}>
              {entry.date}
            </time>
            <Markdown>{entry.body}</Markdown>
          </div>
        )}
      </Modal>
    </div>
  );
}
