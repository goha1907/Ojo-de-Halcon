import { APP_CONFIG, feedbackSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { limitByIp, parseBody } from "@/server/api";
import { getCore } from "@/server/core";
import { getLocale } from "@/server/i18n";
import { getCurrentUser } from "@/server/session";

/** Public: the contact form of the landing page. */
export async function POST(request: Request) {
  const limited = limitByIp(request, "feedback", APP_CONFIG.rateLimit.feedback);
  if (limited) return limited;
  const body = await parseBody(request, feedbackSchema);
  if (!body.ok) return body.response;
  const user = await getCurrentUser();
  await getCore().feedback.submit(body.data, { userId: user?.id ?? null, locale: await getLocale() });
  return NextResponse.json({ ok: true });
}
