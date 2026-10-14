"use client";

import { APP_CONFIG, PRICING, ROUTES, casesPrice, settingsHref } from "@ojo/shared";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { formatMoney } from "@/lib/money";

/** Price of any number of cases, with the ladder spelled out. */
export function Calculator({ signedIn }: { signedIn: boolean }) {
  const { t, locale } = useI18n();
  const max = APP_CONFIG.limits.maxCases;
  const [count, setCount] = useState(5);
  const money = (amount: number) => formatMoney(amount, PRICING.currency, locale);
  const valid = Number.isInteger(count) && count >= 1 && count <= max;
  const total = valid ? casesPrice(count) : 0;
  const ladder = PRICING.ladder;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{t("landing.calc.title")}</h3>
      <div className="mt-4 grid items-end gap-6 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">{t("landing.calc.label")}</span>
          <input
            type="number"
            min={1}
            max={max}
            value={Number.isNaN(count) ? "" : count}
            onChange={(event) => setCount(event.target.value === "" ? Number.NaN : Number(event.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus-visible:outline-2 focus-visible:outline-brand-600"
          />
          <span className="block text-xs text-slate-500">{t("landing.calc.max", { max })}</span>
        </label>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div aria-live="polite">
            <div className="text-sm text-slate-500">
              {t("landing.calc.total", { days: APP_CONFIG.limits.subscriptionDays })}
            </div>
            <div className="text-3xl font-bold text-slate-900">{valid ? money(total) : "—"}</div>
            {valid && (
              <div className="text-sm text-slate-500">
                {t("landing.calc.avg", { amount: money(Math.round(total / count)) })}
              </div>
            )}
          </div>
          {valid ? (
            <Link
              href={signedIn ? `${settingsHref("subscription")}?cases=${count}` : ROUTES.login}
              className="inline-flex rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {t("landing.pricing.buy")}
            </Link>
          ) : (
            <span className="inline-flex cursor-not-allowed rounded-lg bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-500">
              {t("landing.pricing.buy")}
            </span>
          )}
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        {t("landing.calc.rule", {
          p1: money(ladder[0]),
          p2: money(ladder[1]),
          p3: money(ladder[2]),
          p4: money(ladder[3]),
          extra: money(PRICING.extraCase),
        })}
      </p>
    </div>
  );
}
