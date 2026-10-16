import type { TranslateFn } from "@ojo/shared";
import { cn } from "@ojo/ui";
import { LanguageSelectControl } from "./language-select";
import { ThemeSelector, type ThemeLabels } from "@/components/theme/theme-selector";
import { getTheme } from "@/server/theme";

/** Language picker, shown as a short code. Only the first option works for now; the rest are announced. Prices are in ARS only. */
export function LanguageSelect({ t }: { t: TranslateFn }) {
  return (
    <LanguageSelectControl
      label={t("landing.lang")}
      options={[
        { value: "ru", label: "RU" },
        { value: "es", label: t("landing.soonOption", { name: "ES" }), disabled: true },
      ]}
    />
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
