"use client";

import { ContrastIcon, MoonIcon, SunIcon, cn } from "@ojo/ui";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { resolveTheme, themeCookie, type ThemeChoice } from "@/lib/theme";

const OPTIONS: ReadonlyArray<{
  value: ThemeChoice;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: "theme.system" | "theme.light" | "theme.dark";
}> = [
  { value: "system", icon: ContrastIcon, label: "theme.system" },
  { value: "light", icon: SunIcon, label: "theme.light" },
  { value: "dark", icon: MoonIcon, label: "theme.dark" },
];

type ThemeLabelKey = "theme.label" | "theme.system" | "theme.light" | "theme.dark";
export type ThemeLabels = Record<ThemeLabelKey, string>;

const DARK_QUERY = "(prefers-color-scheme: dark)";

function applyTheme(choice: ThemeChoice): void {
  document.documentElement.dataset.theme = resolveTheme(choice, window.matchMedia(DARK_QUERY).matches);
}

function persistTheme(choice: ThemeChoice): void {
  document.cookie = themeCookie(choice);
  applyTheme(choice);
}

/** Three-way switch: follow the system, light, dark. The choice lives in a cookie, so the server renders it too. */
export function ThemeSelector({
  initial,
  className,
  labels,
}: {
  initial: ThemeChoice;
  className?: string;
  /** Fixed wording for places that are not translated (the English-only admin); otherwise the dictionary is used. */
  labels?: ThemeLabels;
}) {
  const translate = useT();
  const t = (key: ThemeLabelKey) => labels?.[key] ?? translate(key);
  const [choice, setChoice] = useState<ThemeChoice>(initial);

  // "system" tracks the device while the page is open
  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  function pick(next: ThemeChoice) {
    setChoice(next);
    persistTheme(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("theme.label")}
      className={cn("inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-[3px]", className)}
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          aria-label={t(label)}
          title={t(label)}
          onClick={() => pick(value)}
          className={cn(
            "grid size-8 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
            choice === value ? "bg-brand text-brand-fg" : "text-fg-muted hover:bg-line/40 hover:text-fg",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
