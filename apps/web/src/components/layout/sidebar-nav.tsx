"use client";

import { cn } from "@ojo/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/providers/i18n-provider";
import { NAVIGATION, isActive } from "@/lib/navigation";

const ITEM = "block rounded-lg px-3 py-2 text-sm transition-colors";
const ACTIVE = "bg-brand-50 font-medium text-brand-700";
const IDLE = "text-slate-700 hover:bg-slate-100";

export function SidebarNav() {
  const t = useT();
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label={t("nav.menu")}>
      {NAVIGATION.map((entry) =>
        entry.kind === "link" ? (
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
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(entry.labelKey)}
            </p>
            <div className="space-y-1">
              {entry.items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={cn(ITEM, "ml-2", isActive(pathname, item.href) ? ACTIVE : IDLE)}
                >
                  {t(item.labelKey)}
                </Link>
              ))}
            </div>
          </div>
        ),
      )}
    </nav>
  );
}
