import { ROUTES, type TranslateFn } from "@ojo/shared";
import Link from "next/link";
import { LegalLinks } from "./legal-links";
import { PreferenceSelectors } from "./preference-selectors";
import { LANDING_SECTIONS } from "./sections";

/** Placeholder payment method until the provider is final. */
const PAYMENT_METHODS = ["Mercado Pago"] as const;

export function LandingFooter({ t }: { t: TranslateFn }) {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-3">
        <div className="space-y-3 text-sm">
          <Link href={ROUTES.home} className="block text-base font-semibold text-white">
            {t("app.name")}
          </Link>
          <p>{t("landing.footer.company")}</p>
          <p className="text-slate-400">{t("landing.footer.disclaimer")}</p>
        </div>
        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">{t("landing.footer.menu")}</div>
          <ul className="space-y-2 text-sm">
            {LANDING_SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="hover:text-white">
                  {t(section.labelKey)}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">{t("landing.footer.docs")}</div>
          <LegalLinks />
        </div>
      </div>
      <div className="border-t border-slate-800">
        <div className="mx-auto grid max-w-6xl items-center gap-4 px-4 py-6 text-xs text-slate-400 md:grid-cols-3">
          <span className="text-center md:text-left">
            {t("landing.footer.copyright", { year: new Date().getFullYear() })}
          </span>
          <div className="flex justify-center">
            <PreferenceSelectors t={t} />
          </div>
          <div className="flex items-center justify-center gap-2 md:justify-end">
            <span>{t("landing.footer.payments")}:</span>
            {PAYMENT_METHODS.map((name) => (
              <span key={name} className="rounded-md border border-slate-600 px-2 py-1 text-slate-200">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
