import { LOCALES, type Locale } from "@ojo/shared";
import { notFound } from "next/navigation";
import Link from "next/link";
import { NewsEditor } from "@/components/admin/news-editor";
import { PageTitle, Panel } from "@/components/admin/ui";
import { getCore } from "@/server/core";
import { readFiles } from "@/server/news";
import { requireStaff } from "@/server/session";

type Texts = Record<Locale, { title: string; summary: string; body: string }>;

export default async function EditNewsPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireStaff("news.manage");
  const { slug } = await params;
  const texts = Object.fromEntries(LOCALES.map((locale) => [locale, { title: "", summary: "", body: "" }])) as Texts;
  const written = (await getCore().admin.listNews()).find((entry) => entry.slug === slug);
  let date: string;
  let time: string;
  if (written) {
    for (const locale of LOCALES) if (written.translations[locale]) texts[locale] = written.translations[locale]!;
    ({ date, time } = written);
  } else {
    const items = (await readFiles()).filter((item) => item.slug === slug);
    if (items.length === 0) notFound();
    for (const item of items) texts[item.locale] = { title: item.title, summary: item.summary, body: item.body };
    ({ date, time } = items[0]!);
  }
  return (
    <>
      <Link href="/admin/news" className="mb-3 inline-block text-sm text-fg-muted hover:underline">
        ← Back to news
      </Link>
      <PageTitle title="Edit news entry" />
      <Panel>
        <NewsEditor slug={slug} date={date} time={time === "00:00" ? "" : time} texts={texts} fromFile={!written} />
      </Panel>
    </>
  );
}
