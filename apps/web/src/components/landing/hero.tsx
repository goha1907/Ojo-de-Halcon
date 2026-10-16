import { APP_CONFIG, ROUTES, type TranslateFn } from "@ojo/shared";
import Link from "next/link";

export function Hero({ t, signedIn }: { t: TranslateFn; signedIn: boolean }) {
  const bullets = [
    t("landing.hero.b1"),
    t("landing.hero.b2"),
    t("landing.hero.b3"),
  ];
  return (
    <section className="bg-bg-subtle">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-fg sm:text-5xl">
            {t("landing.hero.title")}
          </h1>
          <p className="text-lg leading-8 text-fg-muted">{t("landing.hero.text")}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-fg">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="text-success-fg">✓</span>
                {bullet}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={signedIn ? ROUTES.dashboard : ROUTES.register}
              className="inline-flex rounded-lg bg-brand px-6 py-3 text-base font-semibold text-brand-fg shadow-sm hover:bg-brand-hover"
            >
              {signedIn ? t("landing.cta.cabinet") : t("landing.cta.start")}
            </Link>
            <a href="#how" className="inline-flex rounded-lg px-4 py-3 text-base font-medium text-fg hover:bg-line/40">
              {t("landing.nav.how")} →
            </a>
          </div>
          <p className="text-sm text-fg-muted">{t("landing.hero.trial", { days: APP_CONFIG.limits.trialDays })}</p>
        </div>
      </div>
    </section>
  );
}
