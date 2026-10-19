import type { TrackerSection } from "./events";

/**
 * Services as the menu shows them: the service (DNM, RENAPER, PJN, delivery) and its kinds of cases inside. `slug` is the last URL segment:
 * `/services/<group>/<slug>`. Adding a service = one line here + i18n labels.
 */
export const SERVICE_GROUPS = [
  {
    key: "dnm",
    items: [
      { section: "dni_approval", slug: "dni" },
      { section: "citizenship_dnm", slug: "citizenship" },
    ],
  },
  {
    key: "renaper",
    items: [{ section: "dni_production", slug: "dni" }],
  },
  {
    key: "pjn",
    items: [{ section: "citizenship_court", slug: "consulta-publica" }],
  },
  {
    key: "post",
    items: [
      { section: "dni_post", slug: "correo" },
      { section: "post_ocasa", slug: "ocasa" },
    ],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  items: ReadonlyArray<{ section: TrackerSection; slug: string }>;
}>;

export type ServiceGroupKey = (typeof SERVICE_GROUPS)[number]["key"];

/** The service a section belongs to (dnm, renaper, pjn, post). */
export function sectionGroup(section: string): ServiceGroupKey | null {
  return SERVICE_GROUPS.find((group) => group.items.some((item) => item.section === section))?.key ?? null;
}

/** Addresses of the old menu (grouped by topic), sent in mails and bot messages: they lead to the new ones. */
export const LEGACY_SERVICE_PATHS: Record<string, string> = {
  "/services/dni/migraciones": "/services/dnm/dni",
  "/services/dni/renaper": "/services/renaper/dni",
  "/services/citizenship/migraciones": "/services/dnm/citizenship",
  "/services/citizenship/tribunal": "/services/pjn/consulta-publica",
};

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
  post_ocasa: "ocasa-tracking",
  citizenship_dnm: "citizenship-status",
  citizenship_court: "court-status",
};

/** URL of the page that hosts a section; null when the section has no page. */
export function sectionHref(section: TrackerSection): string | null {
  for (const group of SERVICE_GROUPS) {
    const item = group.items.find((candidate) => candidate.section === section);
    if (item) return serviceHref(group.key, item.slug);
  }
  return null;
}
