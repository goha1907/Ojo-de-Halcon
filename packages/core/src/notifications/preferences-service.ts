import type { PrismaClient } from "@ojo/db";
import {
  TRACKER_SECTIONS,
  isTrackerSection,
  resolveServicePreferences,
  type TrackerSection,
} from "@ojo/shared";

export function createPreferencesService(deps: { prisma: PrismaClient }) {
  const { prisma } = deps;

  async function get(userId: string): Promise<Record<TrackerSection, boolean>> {
    const rows = await prisma.servicePreference.findMany({ where: { userId } });
    const overrides: Record<string, boolean> = {};
    for (const row of rows) overrides[row.serviceKey] = row.enabled;
    return resolveServicePreferences(overrides);
  }

  /** Stores on/off for known services; unknown keys are ignored. */
  async function set(userId: string, values: Record<string, boolean>): Promise<void> {
    const entries = Object.entries(values).filter(([key]) => isTrackerSection(key));
    await prisma.$transaction(
      entries.map(([serviceKey, enabled]) =>
        prisma.servicePreference.upsert({
          where: { userId_serviceKey: { userId, serviceKey } },
          create: { userId, serviceKey, enabled },
          update: { enabled },
        }),
      ),
    );
  }

  return { get, set, knownKeys: TRACKER_SECTIONS };
}

export type PreferencesService = ReturnType<typeof createPreferencesService>;
