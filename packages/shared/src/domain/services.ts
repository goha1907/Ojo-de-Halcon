import type { TrackerSection } from "./events";

/**
 * Product services grouped for navigation. `slug` is the last URL segment:
 * `/services/<group>/<slug>`. Adding a service = one line here + i18n labels.
 */
export const SERVICE_GROUPS = [
  {
    key: "dni",
    items: [
      { section: "dni_approval", slug: "migraciones" },
      { section: "dni_production", slug: "renaper" },
      { section: "dni_post", slug: "correo" },
    ],
  },
  {
    key: "citizenship",
    items: [
      { section: "citizenship_dnm", slug: "migraciones" },
      { section: "citizenship_court", slug: "tribunal" },
    ],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  items: ReadonlyArray<{ section: TrackerSection; slug: string }>;
}>;

export type ServiceGroupKey = (typeof SERVICE_GROUPS)[number]["key"];

export function serviceHref(group: string, slug: string): string {
  return `/services/${group}/${slug}`;
}

export function findService(group: string, slug: string) {
  const found = SERVICE_GROUPS.find((g) => g.key === group);
  const item = found?.items.find((i) => i.slug === slug);
  return found && item ? { group: found.key, ...item } : null;
}

/** Official page of each service (id from the useful-links catalog). */
export const SERVICE_OFFICIAL_LINK: Record<TrackerSection, string> = {
  dni_approval: "dni-approval",
  dni_production: "dni-production",
  dni_post: "dni-post",
  citizenship_dnm: "citizenship-status",
  citizenship_court: "court-status",
};
