"use client";

import { cn } from "@ojo/ui";
import { useEffect, useState } from "react";
import { pickActiveSection } from "@/lib/active-section";

export interface SectionLink {
  id: string;
  label: string;
}

/** Share of the window height, from the top, where a section counts as "the one being read". */
const READING_LINE = 0.3;

/**
 * The section the visitor is reading (rule and tests: `lib/active-section.ts`), tracked while scrolling.
 */
function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      const bounds = ids.flatMap((id) => {
        const rect = document.getElementById(id)?.getBoundingClientRect();
        return rect ? [{ id, top: rect.top, bottom: rect.bottom }] : [];
      });
      setActive(pickActiveSection(bounds, window.innerHeight * READING_LINE));
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ids]);

  return active;
}

const STYLES = {
  header: {
    base: "rounded-full px-3 py-1.5 text-sm transition-colors",
    idle: "text-fg-muted hover:bg-line/40 hover:text-fg",
    active: "bg-line/60 font-medium text-fg",
  },
  menu: {
    base: "rounded-field px-3 py-2 text-sm transition-colors",
    idle: "text-fg-muted hover:bg-line/40 hover:text-fg",
    active: "bg-line/60 font-medium text-fg",
  },
  footer: {
    base: "transition-colors",
    idle: "hover:text-fg",
    active: "font-semibold text-fg",
  },
} as const;

/**
 * In-page section links that light up for the section on screen. `header` and `menu` render plain links
 * (the parent is the nav); `footer` renders list items (the parent is the list).
 */
export function SectionLinks({
  sections,
  variant,
}: {
  sections: readonly SectionLink[];
  variant: keyof typeof STYLES;
}) {
  const active = useActiveSection(sections.map((section) => section.id));
  const style = STYLES[variant];
  return sections.map((section) => {
    const link = (
      <a
        key={section.id}
        href={`#${section.id}`}
        aria-current={section.id === active ? "location" : undefined}
        className={cn(style.base, section.id === active ? style.active : style.idle)}
      >
        {section.label}
      </a>
    );
    return variant === "footer" ? <li key={section.id}>{link}</li> : link;
  });
}
