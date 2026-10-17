"use client";

import { LOCALES, type Locale } from "@ojo/shared";
import { Alert } from "@ojo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api-client";
import { CoverPicker } from "./cover-picker";

type Texts = Record<Locale, { title: string; summary: string; body: string }>;

const INPUT = "w-full rounded-field border border-line bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-2 focus-visible:outline-ring";
const LANGUAGE_NAMES: Record<Locale, string> = { ru: "Russian", es: "Spanish", en: "English" };

interface Props {
  /** Set when an existing entry is edited; a new entry gets its slug from the date and a short name. */
  slug: string | null;
  date: string;
  time: string;
  texts: Texts;
  /** The main news (the big card on the home page). */
  featured: boolean;
  /** Cover picture, or null for the default one. */
  image: string | null;
  /** Built-in covers to choose from. */
  covers: readonly string[];
}

/** One form for an entry in every language: a tab per language, one save for all of them. */
export function NewsEditor({
  slug,
  date: initialDate,
  time: initialTime,
  texts: initialTexts,
  featured: initialFeatured,
  image: initialImage,
  covers,
}: Props) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [name, setName] = useState("");
  const [time, setTime] = useState(initialTime);
  const [texts, setTexts] = useState(initialTexts);
  const [active, setActive] = useState<Locale>("ru");
  const [featured, setFeatured] = useState(initialFeatured);
  const [image, setImage] = useState(initialImage ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function change(field: "title" | "summary" | "body", value: string) {
    setTexts((current) => ({ ...current, [active]: { ...current[active], [field]: value } }));
  }

  const missing = LOCALES.filter((locale) => !texts[locale].title.trim() || !texts[locale].body.trim());

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const shortName = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (slug === null && !date) return setError("Pick a date: it becomes the start of the link.");
    if (slug === null && !shortName) return setError("Fill in the short name: latin letters or digits, for example “new-sources”.");
    if (!texts.ru.title.trim() || !texts.ru.body.trim()) {
      setActive("ru");
      return setError("The Russian title and the Russian text are required; the other languages are optional.");
    }
    const finalSlug = slug ?? `${date}-${shortName}`;
    setBusy(true);
    try {
      await apiRequest("/api/admin/news", {
        method: "PUT",
        body: { slug: finalSlug, time: time || "00:00", translations: texts, featured, image: image || null },
      });
      router.push("/admin/news");
      router.refresh();
    } catch {
      setError("Not saved: the server did not accept the entry. Check the date, the time and the cover, then try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
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

      <div className="space-y-4">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-fg">
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
            className="mt-0.5 size-4 rounded border-line accent-brand"
          />
          <span>
            <b className="font-medium">Main news</b>
            <span className="block text-xs text-fg-muted">
              Shown as the big card on the home page. Only one entry can be the main one: saving this one takes the mark from the current main news. Without a main entry the newest news is shown.
            </span>
          </span>
        </label>
        <CoverPicker value={image} onChange={setImage} covers={covers} />
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
