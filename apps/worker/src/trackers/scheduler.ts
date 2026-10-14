import { TRACKER_CONFIG, createTranslator, resolveLocale, type MessageKey } from "@ojo/shared";
import type { Core } from "@ojo/core";
import { logger } from "../logger";
import { formatNotification } from "./format-notification";

export interface SchedulerDeps {
  core: Core;
  /** Sends a Telegram message; throws when it cannot be delivered. */
  send: (telegramId: bigint, text: string) => Promise<void>;
}

/**
 * Periodic loop: checks due trackers, then delivers the resulting events.
 * Ticks never overlap (a slow scrape just delays the next tick).
 */
export function startTrackerScheduler(deps: SchedulerDeps): () => void {
  let busy = false;

  async function deliver(): Promise<void> {
    const pending = await deps.core.trackers.pendingNotifications();
    for (const item of pending) {
      try {
        await deps.send(item.telegramId, formatNotification(item));
        await deps.core.trackers.markNotified(item.eventId);
      } catch (error) {
        // Left unsent: retried on the next tick.
        logger.warn("notification not delivered", {
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }
  }

  const OUTBOX_TEXT: Record<string, MessageKey> = {
    account_deleted: "bot.accountDeleted",
    unlinked: "bot.unlinked",
    case_finished: "bot.caseFinished",
  };

  /** Farewell messages that outlive the user record (account deleted / Telegram unlinked). */
  async function deliverOutbox(): Promise<void> {
    for (const item of await deps.core.telegram.claimOutbox()) {
      const key = OUTBOX_TEXT[item.kind];
      if (!key) {
        await deps.core.telegram.markOutboxSent(item.id);
        continue;
      }
      try {
        const params = (item.payload ?? {}) as Record<string, string>;
        await deps.send(item.telegramId, createTranslator(resolveLocale(item.locale))(key, params));
        await deps.core.telegram.markOutboxSent(item.id);
      } catch (error) {
        await deps.core.telegram.markOutboxFailed(item.id);
        logger.warn("outbox message not delivered", {
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }
  }

  async function tick(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      const checked = await deps.core.trackers.runDue();
      if (checked > 0) logger.info("trackers checked", { checked });
      await deliver();
      await deliverOutbox();
    } catch (error) {
      logger.error("tracker tick failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    } finally {
      busy = false;
    }
  }

  const timer = setInterval(() => void tick(), TRACKER_CONFIG.tickIntervalSeconds * 1000);
  void tick();
  return () => clearInterval(timer);
}
