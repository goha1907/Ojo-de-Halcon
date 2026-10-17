import { APP_CONFIG, ROUTES, type TranslateFn } from "@ojo/shared";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LegalLinks } from "./legal-links";
import { LanguageSelect } from "./preference-selectors";
import { SectionLinks } from "./section-nav";
import { LANDING_SECTIONS } from "./sections";

/**
 * Accepted payment methods: logo files live in `public/payments`. Mercado Pago is the official artwork (2x);
 * Visa and Mastercard are simple flat marks drawn for this site (swap in the official files when you have them).
 */
const PAYMENT_METHODS = [
  { name: "Mercado Pago", logo: "/payments/mercado-pago.png", width: 142, height: 37, chip: "w-[6.75rem]" },
  { name: "Visa", logo: "/payments/visa.svg", width: 70, height: 25, chip: "w-[4.5rem]" },
  { name: "Mastercard", logo: "/payments/mastercard.svg", width: 38, height: 24, chip: "w-[4.5rem]" },
] as const;

export function LandingFooter({ t }: { t: TranslateFn }) {
  return (
    <footer className="border-t border-line bg-bg-subtle text-fg-muted">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-3">
        <div className="space-y-3 text-sm">
          <Link href={ROUTES.home} className="inline-block">
            <Logo alt={t("app.name")} height={40} />
          </Link>
          <p>{t("landing.footer.company")}</p>
          <p>
            {t("landing.footer.support")}{" "}
            <a href={`mailto:${APP_CONFIG.contact.supportEmail}`} className="underline hover:text-fg">
              {APP_CONFIG.contact.supportEmail}
            </a>
          </p>
          <p className="text-fg-muted">{t("landing.footer.disclaimer")}</p>
        </div>
        <div className="space-y-3">
          <div className="text-sm font-semibold text-fg">{t("landing.footer.menu")}</div>
          <ul className="space-y-2 text-sm">
            <SectionLinks
              sections={LANDING_SECTIONS.map((section) => ({ id: section.id, label: t(section.labelKey) }))}
              variant="footer"
            />
          </ul>
        </div>
        <div className="space-y-3">
          <div className="text-sm font-semibold text-fg">{t("landing.footer.docs")}</div>
          <LegalLinks />
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-4 px-4 py-6 text-xs text-fg-muted md:grid-cols-[1fr_auto_1fr]">
          <span className="text-center md:text-left">
            {t("landing.footer.copyright", { year: new Date().getFullYear() })}
          </span>
          <div className="flex justify-center">
            <LanguageSelect t={t} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 md:justify-end">
            <span>{t("landing.footer.payments")}:</span>
            {PAYMENT_METHODS.map((method) => (
              // same size and shape for every badge; white in both themes, as payment badges usually are
              <span
                key={method.name}
                className={`grid h-10 place-items-center rounded-lg border border-black/10 bg-white px-2.5 shadow-sm ${method.chip}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={method.logo} alt={method.name} width={method.width} height={method.height} className="h-5 w-auto max-w-full" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
