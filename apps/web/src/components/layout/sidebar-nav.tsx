"use client";

import { cn } from "@ojo/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/providers/i18n-provider";
import { NAVIGATION, isActive } from "@/lib/navigation";

const ITEM = "block rounded-field px-3 py-2 text-sm transition-colors";
const ACTIVE = "bg-line/70 font-medium text-fg";
const IDLE = "text-fg hover:bg-line/40";

/** `counts` maps a section id to the number of cases the user has there. */
export function SidebarNav({
  counts = {},
  hidden = [],
}: {
  counts?: Record<string, number>;
  /** Section ids left out of the menu (services not open to this account yet). */
  hidden?: readonly string[];
}) {
  const t = useT();
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label={t("nav.menu")}>
      {NAVIGATION.map((entry) =>
        entry.kind === "link" && entry.id !== "dashboard" ? (
          <div key={entry.id} className="pt-3">
            <Link
              href={entry.href}
              aria-current={isActive(pathname, entry.href) ? "page" : undefined}
              className={cn(
                "block rounded-field px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors hover:text-fg",
                isActive(pathname, entry.href) ? "bg-line/70 text-fg" : "text-fg-muted",
              )}
            >
              {t(entry.labelKey)}
            </Link>
          </div>
        ) : entry.kind === "link" ? (
          <Link
            key={entry.id}
            href={entry.href}
            aria-current={isActive(pathname, entry.href) ? "page" : undefined}
            className={cn(ITEM, isActive(pathname, entry.href) ? ACTIVE : IDLE)}
          >
            {t(entry.labelKey)}
          </Link>
        ) : (
          <div key={entry.id} className="pt-3">
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              {t(entry.labelKey)}
            </p>
            <div className="space-y-1">
              {entry.items.filter((item) => !hidden.includes(item.id)).map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={cn(ITEM, "ml-2", isActive(pathname, item.href) ? ACTIVE : IDLE)}
                >
                  {t(item.labelKey)}
                  {(counts[item.id] ?? 0) > 0 && (
                    <span className="ml-1 text-fg-muted">({counts[item.id]})</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ),
      )}
    </nav>
  );
}
