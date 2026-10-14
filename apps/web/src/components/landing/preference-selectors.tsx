import type { TranslateFn } from "@ojo/shared";

/** Language and currency pickers. Only the first option of each works for now; the rest are announced. */
export function PreferenceSelectors({ t, currency = true }: { t: TranslateFn; currency?: boolean }) {
  const select =
    "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600";
  return (
    <div className="flex items-center gap-2">
      <select aria-label={t("landing.lang")} defaultValue="ru" className={select}>
        <option value="ru">Русский</option>
        <option value="es" disabled>
          {t("landing.soonOption", { name: "Español" })}
        </option>
      </select>
      {currency && (
        <select aria-label={t("landing.currency")} defaultValue="ARS" className={select}>
          <option value="ARS">ARS</option>
          <option value="USD" disabled>
            {t("landing.soonOption", { name: "USD" })}
          </option>
        </select>
      )}
    </div>
  );
}
