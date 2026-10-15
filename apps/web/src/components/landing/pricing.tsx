import {
  APP_CONFIG,
  PRICING,
  ROUTES,
  casesPrice,
  settingsHref,
  type MessageKey,
  type TranslateFn,
} from "@ojo/shared";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { randomVariant } from "@/lib/variant";
import { Calculator } from "./calculator";

const PLANS = [1, 3, 5] as const;
const POPULAR = 3;
/** Wordings of the line for corporate clients (keys `landing.pricing.corporate.<n>`); one is shown per visit. */
const CORPORATE_VARIANTS = 6;

/** Plans for 1, 3 and 5 cases, then a calculator for any number. Prices come from the config ladder. */
export function Pricing({ t, locale, signedIn }: { t: TranslateFn; locale: string; signedIn: boolean }) {
  const days = APP_CONFIG.limits.subscriptionDays;
  const money = (amount: number) => formatMoney(amount, PRICING.currency, locale);
  // a visitor signs in first; a signed-in user goes straight to buying places for that many trackings
  const buyHref = (count: number) =>
    signedIn ? `${settingsHref("subscription")}?cases=${count}` : ROUTES.login;
  return (
    <section id="pricing" className="scroll-mt-20 mx-auto max-w-6xl space-y-8 px-4 py-16">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-900">{t("landing.pricing.title")}</h2>
        <p className="text-slate-600">{t("landing.pricing.subtitle", { days })}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((count) => {
          const total = casesPrice(count);
          const popular = count === POPULAR;
          return (
            <div
              key={count}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                popular ? "border-brand-600 ring-2 ring-brand-600/20" : "border-slate-200"
              }`}
            >
              {popular && (
                <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-semibold text-white">
                  {t("landing.pricing.popular")}
                </span>
              )}
              <h3 className="text-lg font-semibold text-slate-900">{t("landing.pricing.cases", { count })}</h3>
              <div className="mt-3 text-3xl font-bold text-slate-900">{money(total)}</div>
              <div className="text-sm text-slate-500">{t("landing.pricing.period", { days })}</div>
              <div className="mt-1 text-sm text-slate-500">
                {t("landing.pricing.perCase", { amount: money(Math.round(total / count)) })}
              </div>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-700">
                {(["f1", "f2", "f3"] as const).map((key) => (
                  <li key={key} className="flex gap-2">
                    <span aria-hidden="true" className="text-emerald-600">✓</span>
                    {t(`landing.pricing.${key}`)}
                  </li>
                ))}
              </ul>
              <Link
                href={buyHref(count)}
                className={`mt-6 inline-flex justify-center rounded-lg px-4 py-2.5 text-sm font-semibold ${
                  popular
                    ? "bg-brand-600 text-white hover:bg-brand-700"
                    : "border border-slate-300 text-slate-900 hover:bg-slate-50"
                }`}
              >
                {t("landing.pricing.buy")}
              </Link>
            </div>
          );
        })}
      </div>
      <Calculator signedIn={signedIn} />
      <p className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
        {t(`landing.pricing.corporate.${randomVariant(CORPORATE_VARIANTS)}` as MessageKey)}{" "}
        <a
          href={`mailto:${APP_CONFIG.contact.supportEmail}`}
          className="font-medium text-brand-700 underline hover:text-brand-600"
        >
          {APP_CONFIG.contact.supportEmail}
        </a>
      </p>
      <p className="text-sm text-slate-500">{t("landing.pricing.trial", { days: APP_CONFIG.limits.trialDays })}</p>
      <p className="text-sm text-slate-500">{t("landing.pricing.note")}</p>
    </section>
  );
}
