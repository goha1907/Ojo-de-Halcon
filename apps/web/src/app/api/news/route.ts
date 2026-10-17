import { APP_CONFIG } from "@ojo/shared";
import { NextResponse } from "next/server";
import { getLocale } from "@/server/i18n";
import { getFeaturedNews, listNewsPage } from "@/server/news";

/** Public: one page of news titles (the landing page pages through them). */
export async function GET(request: Request) {
  const page = Number(new URL(request.url).searchParams.get("page") ?? "1");
  const locale = await getLocale();
  const featured = await getFeaturedNews(locale);
  const result = await listNewsPage(locale, page, APP_CONFIG.news.pageSize, featured?.slug);
  return NextResponse.json(result);
}
