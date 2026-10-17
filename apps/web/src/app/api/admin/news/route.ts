import { NEWS_SLUG_PATTERN } from "@ojo/core";
import { LOCALES, NEWS_COVER_PATTERN } from "@ojo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withStaff } from "@/server/api";
import { getCore } from "@/server/core";

const translation = z.object({ title: z.string().max(200), summary: z.string().max(500), body: z.string().max(50_000) });

const bodySchema = z.object({
  slug: z.string().regex(NEWS_SLUG_PATTERN).max(120),
  time: z.string(),
  translations: z.object(Object.fromEntries(LOCALES.map((locale) => [locale, translation.optional()]))),
  featured: z.boolean().optional(),
  image: z.string().regex(NEWS_COVER_PATTERN).nullable().optional(),
});

/** Publishes or changes a news entry in all languages at once. */
export async function PUT(request: Request) {
  return withStaff("news.manage", async (staff) => {
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const result = await getCore().admin.saveNews({ id: staff.id, email: staff.email }, body.data);
    if (!result.ok) return apiError("BAD_REQUEST");
    return NextResponse.json({ ok: true });
  });
}
