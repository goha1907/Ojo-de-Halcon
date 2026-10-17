import type { Core } from "@ojo/core";
import { createTranslator, resolveLocale } from "@ojo/shared";
import { Bot, InlineKeyboard } from "grammy";
import { logger } from "../logger";
import { formatDigest } from "../trackers/format-digest";
import { handleStart } from "./start-handler";

/** Telegram bot that confirms sign-in / sign-up codes (`/start <code>`). */
/** Telegram refuses buttons that lead to local addresses: only a public https address gets a button. */
export function publicSiteUrl(appUrl: string | undefined): string | null {
  if (!appUrl) return null;
  try {
    const url = new URL(appUrl);
    const local = url.hostname === "localhost" || /^(127\.|10\.|192\.168\.)/.test(url.hostname) || url.hostname.endsWith(".local");
    return url.protocol === "https:" && !local ? url.toString() : null;
  } catch {
    return null;
  }
}

export function createBot(options: { token: string; core: Core; appUrl?: string }): Bot {
  const bot = new Bot(options.token);

  bot.command("start", async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    const t = createTranslator(resolveLocale(from.language_code));
    try {
      const outcome = await handleStart({
        core: options.core,
        payload: ctx.match,
        from: { id: from.id, ...(from.username ? { username: from.username } : {}) },
      });
      const site = outcome.key === "bot.welcome" ? publicSiteUrl(options.appUrl) : null;
      await ctx.reply(t(outcome.key), {
        link_preview_options: { is_disabled: true },
        ...(site ? { reply_markup: new InlineKeyboard().url(t("bot.welcomeButton"), site) } : {}),
      });
      if (outcome.linkedUserId) await sendDigest(ctx, outcome.linkedUserId, from.language_code);
    } catch (error) {
      logger.error("start handler failed", { error: error instanceof Error ? error.message : "unknown" });
      await ctx.reply(t("bot.error"));
    }
  });

  /** Latest stage of every case, in menu order, right after the welcome message. */
  async function sendDigest(
    ctx: { reply: (text: string) => Promise<unknown> },
    userId: string,
    languageCode: string | undefined,
  ): Promise<void> {
    try {
      const items = await options.core.trackers.latestSteps(userId);
      for (const item of items) await ctx.reply(formatDigest(item, languageCode ?? ""));
    } catch (error) {
      logger.error("digest failed", { error: error instanceof Error ? error.message : "unknown" });
    }
  }

  bot.catch((error) => {
    logger.error("bot error", { error: error.error instanceof Error ? error.error.message : "unknown" });
  });

  return bot;
}
