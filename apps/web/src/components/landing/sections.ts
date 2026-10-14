import type { MessageKey } from "@ojo/shared";

/** Landing sections reachable from the header and footer menus (anchor ids). */
export const LANDING_SECTIONS: ReadonlyArray<{ id: string; labelKey: MessageKey }> = [
  { id: "how", labelKey: "landing.nav.how" },
  { id: "pricing", labelKey: "landing.nav.pricing" },
  { id: "news", labelKey: "landing.nav.news" },
  { id: "faq", labelKey: "landing.nav.faq" },
];
