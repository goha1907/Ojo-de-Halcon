import { NextResponse } from "next/server";
import { apiError } from "@/server/api";
import { getLocale } from "@/server/i18n";
import { coverOf, getNewsWithNeighbours } from "@/server/news";

/** Public: one news entry with its Markdown body (opened in a modal). */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await getNewsWithNeighbours(slug, await getLocale());
  if (!found) return apiError("NOT_FOUND");
  const { item, newer, older } = found;
  return NextResponse.json({ slug: item.slug, date: item.date, time: item.time, title: item.title, image: coverOf(item), body: item.body, newer, older });
}
