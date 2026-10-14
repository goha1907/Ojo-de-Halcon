import { TRACKER_CONFIG } from "@ojo/shared";
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

  async function tick(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      const checked = await deps.core.trackers.runDue();
      if (checked > 0) logger.info("trackers checked", { checked });
      await deliver();
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
