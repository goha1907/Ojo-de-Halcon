import { createCoreFromEnv } from "@ojo/core";
import { loadEnv } from "@ojo/shared";
import { createBot } from "./bot/create-bot";
import { logger } from "./logger";
import { startTrackerScheduler } from "./trackers/scheduler";

const PURGE_INTERVAL_MS = 60 * 60 * 1000;

async function main(): Promise<void> {
  const env = loadEnv();
  if (!env.TELEGRAM_BOT_TOKEN) {
    logger.error("TELEGRAM_BOT_TOKEN is empty: fill it in the root .env and restart");
    process.exit(1);
  }

  const core = createCoreFromEnv(env);
  const bot = createBot({ token: env.TELEGRAM_BOT_TOKEN, core, appUrl: env.APP_URL });

  const purge = setInterval(() => {
    Promise.all([core.telegram.purgeExpired(), core.sessions.purgeExpired()])
      .then(([linkCodes, sessions]) =>
        logger.info("purged expired data", { linkCodes, sessions }),
      )
      .catch((error: unknown) =>
        logger.error("purge failed", { error: error instanceof Error ? error.message : "unknown" }),
      );
  }, PURGE_INTERVAL_MS);

  const stopScheduler = startTrackerScheduler({
    core,
    send: async (telegramId, text) => {
      await bot.api.sendMessage(Number(telegramId), text);
    },
  });

  const shutdown = async () => {
    clearInterval(purge);
    stopScheduler();
    await bot.stop();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  logger.info("starting bot (long polling)");
  await bot.start({
    onStart: (me) => logger.info("bot started", { username: me.username }),
  });
}

main().catch((error: unknown) => {
  logger.error("worker crashed", { error: error instanceof Error ? error.message : "unknown" });
  process.exit(1);
});
