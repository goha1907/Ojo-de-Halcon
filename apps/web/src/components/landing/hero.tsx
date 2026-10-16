import { APP_CONFIG, ROUTES, type TranslateFn } from "@ojo/shared";
import { ArrowRightIcon, CheckIcon, buttonClass } from "@ojo/ui";
import Link from "next/link";
import { HeroDemo } from "./hero-demo";

/** Proper names, not translated. */
const SOURCES_LINE = "RENAPER, Migraciones, Correo, PJN";

export function Hero({ t, signedIn }: { t: TranslateFn; signedIn: boolean }) {
  const bullets = [t("landing.hero.b1"), t("landing.hero.b2"), t("landing.hero.b3")];
  return (
    <section className="relative overflow-x-clip">
      <div className="relative mx-auto max-w-6xl px-4 py-14 sm:py-20">
        {/* the mark behind the page: mirrored, its top edge level with the header, sized by the content width */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
          <div className="hawk-mask absolute -right-[2%] -top-[3.3rem] w-[66%] -scale-x-100 text-brand opacity-[0.08] dark:opacity-[0.14]" />
        </div>
        <div className="relative z-10 grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div className="inline-flex flex-wrap items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pl-3 pr-4 text-xs text-fg-muted">
              <span aria-hidden="true" className="live-dot relative size-2 rounded-full bg-success text-success" />
              <b className="font-semibold text-fg">{t("landing.hero.eyebrow")}</b>
              {SOURCES_LINE}
            </div>
            <h1 className="text-balance text-[clamp(2.3rem,5.1vw,4.2rem)] font-[750] leading-[1.04] tracking-tight text-fg">
              {t("landing.hero.title")}
            </h1>
            <p className="max-w-[54ch] text-lg leading-8 text-fg-muted">{t("landing.hero.text")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={signedIn ? ROUTES.dashboard : ROUTES.register} className={buttonClass({ size: "lg" })}>
                {signedIn ? t("landing.cta.cabinet") : t("landing.cta.start")}
                <ArrowRightIcon />
              </Link>
              <a href="#how" className={buttonClass({ variant: "secondary", size: "lg" })}>
                {t("landing.nav.how")}
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg-muted">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-center gap-1.5">
                  <CheckIcon className="text-success" />
                  {bullet}
                </li>
              ))}
            </ul>
            <p className="text-sm text-fg-muted">{t("landing.hero.trial", { days: APP_CONFIG.limits.trialDays })}</p>
          </div>
          <HeroDemo />
        </div>
      </div>
    </section>
  );
}
