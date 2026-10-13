import { ROUTES, SERVICE_GROUPS, serviceHref, type MessageKey } from "@ojo/shared";

export interface NavLink {
  kind: "link";
  id: string;
  href: string;
  labelKey: MessageKey;
}

export interface NavGroup {
  kind: "group";
  id: string;
  labelKey: MessageKey;
  items: Array<{ id: string; href: string; labelKey: MessageKey }>;
}

export type NavEntry = NavLink | NavGroup;

/** Sidebar structure. Services come from SERVICE_GROUPS, so new ones appear automatically. */
export const NAVIGATION: NavEntry[] = [
  { kind: "link", id: "dashboard", href: ROUTES.dashboard, labelKey: "nav.dashboard" },
  ...SERVICE_GROUPS.map(
    (group): NavGroup => ({
      kind: "group",
      id: group.key,
      labelKey: `menu.group.${group.key}` as MessageKey,
      items: group.items.map((item) => ({
        id: item.section,
        href: serviceHref(group.key, item.slug),
        labelKey: `menu.${item.section}` as MessageKey,
      })),
    }),
  ),
  { kind: "link", id: "news", href: ROUTES.news, labelKey: "nav.news" },
  { kind: "link", id: "links", href: ROUTES.links, labelKey: "nav.links" },
  { kind: "link", id: "settings", href: ROUTES.settings, labelKey: "nav.settings" },
];

/** A link is active on its own path and on any nested path. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
