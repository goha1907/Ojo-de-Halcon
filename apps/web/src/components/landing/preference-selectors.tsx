import type { TranslateFn } from "@ojo/shared";
import { cn } from "@ojo/ui";
import { ThemeSelector, type ThemeLabels } from "@/components/theme/theme-selector";
import { getTheme } from "@/server/theme";

/** Language picker, shown as a short code. Only the first option works for now; the rest are announced. Prices are in ARS only. */
export function LanguageSelect({ t, className }: { t: TranslateFn; className?: string }) {
  return (
    <select
      aria-label={t("landing.lang")}
      defaultValue="ru"
      className={cn(
        "w-[4.5rem] rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-fg focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
    >
      <option value="ru" title="Русский">
        RU
      </option>
      <option value="es" disabled title="Español">
        {t("landing.soonOption", { name: "ES" })}
      </option>
    </select>
  );
}

/** The colour theme switch on its own. */
export async function ThemeSwitch({ labels }: { labels?: ThemeLabels }) {
  return <ThemeSelector initial={await getTheme()} labels={labels} />;
}

/** Language and theme side by side (public header, footer, sign-in header, cabinet menu). */
export async function PreferenceSelectors({
  t,
  className,
}: {
  t: TranslateFn;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LanguageSelect t={t} />
      <ThemeSwitch />
    </div>
  );
}
