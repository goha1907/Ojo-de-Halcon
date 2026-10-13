import type { Core } from "@ojo/core";
import { createTranslator, resolveLocale } from "@ojo/shared";
import { Bot } from "grammy";
import { logger } from "../logger";
import { handleStart } from "./start-handler";

/** Telegram bot that confirms sign-in / sign-up codes (`/start <code>`). */
export function createBot(options: { token: string; core: Core }): Bot {
  const bot = new Bot(options.token);

  bot.command("start", async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    const t = createTranslator(resolveLocale(from.language_code));
    try {
      const key = await handleStart({
        core: options.core,
        payload: ctx.match,
        from: { id: from.id, ...(from.username ? { username: from.username } : {}) },
      });
      await ctx.reply(t(key));
    } catch (error) {
      logger.error("start handler failed", { error: error instanceof Error ? error.message : "unknown" });
      await ctx.reply(t("bot.error"));
    }
  });

  bot.catch((error) => {
    logger.error("bot error", { error: error.error instanceof Error ? error.error.message : "unknown" });
  });

  return bot;
}
