import { LOCALES, type Locale } from "@ojo/shared";
import { notFound } from "next/navigation";
import Link from "next/link";
import { NewsEditor } from "@/components/admin/news-editor";
import { PageTitle, Panel } from "@/components/admin/ui";
import { getCore } from "@/server/core";
import { listCovers } from "@/server/news";
import { requireStaff } from "@/server/session";

type Texts = Record<Locale, { title: string; summary: string; body: string }>;

export default async function EditNewsPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireStaff("news.manage");
  const { slug } = await params;
  const texts = Object.fromEntries(LOCALES.map((locale) => [locale, { title: "", summary: "", body: "" }])) as Texts;
  const written = (await getCore().admin.listNews()).find((entry) => entry.slug === slug);
  if (!written) notFound();
  for (const locale of LOCALES) if (written.translations[locale]) texts[locale] = written.translations[locale]!;
  return (
    <>
      <Link href="/admin/news" className="mb-3 inline-block text-sm text-fg-muted hover:underline">
        ← Back to news
      </Link>
      <PageTitle title="Edit news entry" />
      <Panel>
        <NewsEditor slug={slug} date={written.date} time={written.time === "00:00" ? "" : written.time} texts={texts} featured={written.featured} image={written.image} covers={await listCovers()} />
      </Panel>
    </>
  );
}
