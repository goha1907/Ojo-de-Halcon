import { ROUTES } from "@ojo/shared";
import { Card } from "@ojo/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/news/markdown";
import { getT } from "@/server/i18n";
import { getNews } from "@/server/news";

export default async function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, locale } = await getT();
  const item = await getNews(slug, locale);
  if (!item) notFound();

  return (
    <>
      <Link href={ROUTES.news} className="text-sm text-brand-600 hover:underline">
        ← {t("news.back")}
      </Link>
      <Card>
        <time className="text-xs text-slate-500" dateTime={item.date}>
          {item.date}
        </time>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{item.title}</h1>
        <Markdown>{item.body}</Markdown>
      </Card>
    </>
  );
}
