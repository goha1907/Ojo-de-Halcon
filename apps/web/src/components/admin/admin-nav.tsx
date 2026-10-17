"use client";

import { cn } from "@ojo/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive } from "@/lib/navigation";

/** Admin sections; the current one is highlighted (pages inside a section keep it lit). */
export function AdminNav({ items }: { items: readonly { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2" aria-label="Admin sections">
      {items.map((item) => {
        // the overview lives at the root of the area, so it must not light up on every page
        const current = item.href === "/admin" ? pathname === item.href : isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors",
              current ? "bg-line/70 font-medium text-fg" : "text-fg-muted hover:bg-line/40 hover:text-fg",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
