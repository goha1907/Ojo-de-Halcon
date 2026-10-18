import { TRACKER_CONFIG, createTranslator, resolveLocale, type MessageKey } from "@ojo/shared";
import type { Core } from "@ojo/core";
import { logger } from "../logger";
import { formatNotification, notificationButton } from "./format-notification";

export interface SchedulerDeps {
  core: Core;
  /** Sends a Telegram message; throws when it cannot be delivered. */
  send: (telegramId: bigint, text: string, button?: { text: string; url: string }) => Promise<void>;
  /** Public https address of the site: when set, notifications carry an "Open in the cabinet" button. */
  siteUrl?: string | null;
}

/**
 * Two loops: one checks due trackers (slow: it scrapes), one delivers the resulting events and queued messages
 * (fast). Each never overlaps itself, and a slow scrape does not hold messages back.
 */
export function startTrackerScheduler(deps: SchedulerDeps): () => void {
  let checking = false;
  let delivering = false;

  async function deliver(): Promise<void> {
    const pending = await deps.core.trackers.pendingNotifications();
    for (const item of pending) {
      try {
        await deps.send(item.telegramId, formatNotification(item), notificationButton(item, deps.siteUrl));
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
    free_places_ended: "bot.freePlacesEnded",
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

  /** Reads the sources that are due. A slow scrape only delays the next check, never the delivery below. */
  async function checkTick(): Promise<void> {
    if (checking) return;
    checking = true;
    try {
      const checked = await deps.core.trackers.runDue();
      if (checked > 0) logger.info("trackers checked", { checked });
    } catch (error) {
      logger.error("tracker check failed", { error: error instanceof Error ? error.message : "unknown" });
    } finally {
      checking = false;
    }
  }

  /** Sends what is waiting (new stages, farewell and notice messages) within seconds. */
  async function deliveryTick(): Promise<void> {
    if (delivering) return;
    delivering = true;
    try {
      await deliver();
      await deliverOutbox();
    } catch (error) {
      logger.error("delivery failed", { error: error instanceof Error ? error.message : "unknown" });
    } finally {
      delivering = false;
    }
  }

  const checkTimer = setInterval(() => void checkTick(), TRACKER_CONFIG.tickIntervalSeconds * 1000);
  const deliveryTimer = setInterval(() => void deliveryTick(), TRACKER_CONFIG.deliveryIntervalSeconds * 1000);
  void checkTick();
  void deliveryTick();
  return () => {
    clearInterval(checkTimer);
    clearInterval(deliveryTimer);
  };
}
