import type { Core } from "@ojo/core";
import { createTranslator, resolveLocale } from "@ojo/shared";
import { Bot } from "grammy";
import { logger } from "../logger";
import { formatDigest } from "../trackers/format-digest";
import { handleStart } from "./start-handler";

/** Telegram bot that confirms sign-in / sign-up codes (`/start <code>`). */
export function createBot(options: { token: string; core: Core }): Bot {
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
      await ctx.reply(t(outcome.key));
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
