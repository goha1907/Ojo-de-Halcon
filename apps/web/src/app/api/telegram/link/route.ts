import { APP_CONFIG, buildBotDeepLink } from "@ojo/shared";
import { NextResponse } from "next/server";
import { apiError, withUser } from "@/server/api";
import { getCore } from "@/server/core";
import { getEnv } from "@/server/env";
import { rateLimit } from "@/server/rate-limit";

/** Issues a one-time code (and bot link) for linking Telegram to this account. */
export async function POST() {
  return withUser(async (user) => {
    const env = getEnv();
    if (!env.TELEGRAM_BOT_USERNAME) return apiError("NOT_CONFIGURED");
    if (!rateLimit(`tglink:${user.id}`, APP_CONFIG.rateLimit.telegramLink).allowed) {
      return apiError("RATE_LIMITED");
    }
    const { code, expiresAt } = await getCore().telegram.createLinkCode(user.id);
    return NextResponse.json({
      code,
      deepLink: buildBotDeepLink(env.TELEGRAM_BOT_USERNAME, code),
      expiresAt: expiresAt.toISOString(),
    });
  });
}

/** Polled by the settings page while the user is confirming in Telegram. */
export async function GET() {
  return withUser(async (user) => {
    if (!rateLimit(`tglink:${user.id}`, APP_CONFIG.rateLimit.telegramLink).allowed) {
      return apiError("RATE_LIMITED");
    }
    return NextResponse.json({ linked: user.telegramLinked, username: user.telegramUsername });
  });
}
