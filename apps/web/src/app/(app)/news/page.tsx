import { Card } from "@ojo/ui";
import Link from "next/link";
import { listNews } from "@/server/news";
import { getT } from "@/server/i18n";
import { ROUTES } from "@ojo/shared";

export default async function NewsPage() {
  const { t, locale } = await getT();
  const items = await listNews(locale);

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">{t("news.title")}</h1>
        <p className="text-sm text-slate-600">{t("news.subtitle")}</p>
      </header>
      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">{t("news.empty")}</p>
        </Card>
      ) : (
        items.map((item) => (
          <Card key={item.slug}>
            <time className="text-xs text-slate-500" dateTime={item.date}>
              {item.date}
            </time>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              <Link href={`${ROUTES.news}/${item.slug}`} className="hover:underline">
                {item.title}
              </Link>
            </h2>
            {item.summary && <p className="mt-1 text-sm text-slate-600">{item.summary}</p>}
          </Card>
        ))
      )}
    </>
  );
}
