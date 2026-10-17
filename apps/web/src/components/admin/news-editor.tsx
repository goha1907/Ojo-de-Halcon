"use client";

import { LOCALES, type Locale } from "@ojo/shared";
import { Alert } from "@ojo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api-client";

type Texts = Record<Locale, { title: string; summary: string; body: string }>;

const INPUT = "w-full rounded-field border border-line bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-2 focus-visible:outline-ring";
const LANGUAGE_NAMES: Record<Locale, string> = { ru: "Russian", es: "Spanish", en: "English" };

interface Props {
  /** Set when an existing entry is edited; a new entry gets its slug from the date and a short name. */
  slug: string | null;
  date: string;
  time: string;
  texts: Texts;
  /** The entry comes from a file in the repository: saving here replaces it. */
  fromFile?: boolean;
}

/** One form for an entry in every language: a tab per language, one save for all of them. */
export function NewsEditor({ slug, date: initialDate, time: initialTime, texts: initialTexts, fromFile = false }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [name, setName] = useState("");
  const [time, setTime] = useState(initialTime);
  const [texts, setTexts] = useState(initialTexts);
  const [active, setActive] = useState<Locale>("ru");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function change(field: "title" | "summary" | "body", value: string) {
    setTexts((current) => ({ ...current, [active]: { ...current[active], [field]: value } }));
  }

  const missing = LOCALES.filter((locale) => !texts[locale].title.trim() || !texts[locale].body.trim());

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const finalSlug = slug ?? `${date}-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    setBusy(true);
    try {
      await apiRequest("/api/admin/news", {
        method: "PUT",
        body: { slug: finalSlug, time, translations: texts },
      });
      router.push("/admin/news");
      router.refresh();
    } catch {
      setError("Not saved. Check the date, the short name (latin letters and digits) and the Russian title and text.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {fromFile && <Alert tone="info">This entry is kept as a file. Saving here publishes the version below instead of the file.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm text-fg-muted">
          Date
          <input type="date" required disabled={slug !== null} value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
        </label>
        <label className="space-y-1 text-sm text-fg-muted">
          Time (optional, orders the day)
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={INPUT} />
        </label>
        <label className="space-y-1 text-sm text-fg-muted">
          Short name (latin, used in the link)
          <input required={slug === null} disabled={slug !== null} value={slug ? slug.slice(11) : name} onChange={(e) => setName(e.target.value)} placeholder="new-sources" className={INPUT} />
        </label>
      </div>

      <div role="tablist" aria-label="Language" className="flex gap-1 border-b border-line">
        {LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            role="tab"
            aria-selected={active === locale}
            onClick={() => setActive(locale)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${active === locale ? "border-brand font-medium text-fg" : "border-transparent text-fg-muted hover:text-fg"}`}
          >
            {LANGUAGE_NAMES[locale]}
            {missing.includes(locale) && <span title="Not filled in" className="ml-1 text-warning-fg">•</span>}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <label className="block space-y-1 text-sm text-fg-muted">
          Title
          <input value={texts[active].title} onChange={(e) => change("title", e.target.value)} maxLength={200} className={INPUT} />
        </label>
        <label className="block space-y-1 text-sm text-fg-muted">
          Short summary
          <input value={texts[active].summary} onChange={(e) => change("summary", e.target.value)} maxLength={500} className={INPUT} />
        </label>
        <label className="block space-y-1 text-sm text-fg-muted">
          Text (Markdown)
          <textarea value={texts[active].body} onChange={(e) => change("body", e.target.value)} rows={14} className={`${INPUT} font-mono`} />
        </label>
      </div>

      {missing.length > 0 && (
        <p className="text-sm text-fg-muted">
          Not filled in: {missing.map((locale) => LANGUAGE_NAMES[locale]).join(", ")}. Readers of an empty language see the Russian text. The Russian version is required.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy} className="rounded-field bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover disabled:opacity-50">
          {busy ? "Saving…" : "Publish in all languages"}
        </button>
        <Link href="/admin/news" className="rounded-field border border-line px-4 py-2 text-sm hover:bg-line/40">
          Cancel
        </Link>
      </div>
    </form>
  );
}
