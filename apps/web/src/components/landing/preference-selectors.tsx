import type { TranslateFn } from "@ojo/shared";

/** Language picker. Only the first option works for now; the rest are announced. Prices are in ARS only. */
export function PreferenceSelectors({ t }: { t: TranslateFn }) {
  const select =
    "rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-fg focus-visible:outline-2 focus-visible:outline-ring";
  return (
    <div className="flex items-center gap-2">
      <select aria-label={t("landing.lang")} defaultValue="ru" className={select}>
        <option value="ru">Русский</option>
        <option value="es" disabled>
          {t("landing.soonOption", { name: "Español" })}
        </option>
      </select>
    </div>
  );
}
