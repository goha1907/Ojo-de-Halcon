import { NextResponse } from "next/server";
import { apiError } from "@/server/api";
import { getLocale } from "@/server/i18n";
import { getNews } from "@/server/news";

/** Public: one news entry with its Markdown body (opened in a modal). */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getNews(slug, await getLocale());
  if (!item) return apiError("NOT_FOUND");
  return NextResponse.json({ slug: item.slug, date: item.date, title: item.title, body: item.body });
}
