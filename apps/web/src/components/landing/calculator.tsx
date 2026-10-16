"use client";

import { APP_CONFIG, PRICING, ROUTES, casesPrice, settingsHref } from "@ojo/shared";
import { TextField, buttonClass } from "@ojo/ui";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { formatMoney } from "@/lib/money";

/** Price of any number of cases, with the ladder spelled out. */
export function Calculator({ signedIn }: { signedIn: boolean }) {
  const { t, locale } = useI18n();
  const max = APP_CONFIG.limits.maxCases;
  const [raw, setRaw] = useState("5");
  const count = raw === "" ? 0 : Number(raw);
  const money = (amount: number) => formatMoney(amount, PRICING.currency, locale);
  const valid = count >= 1 && count <= max;
  const total = valid ? casesPrice(count) : 0;
  const ladder = PRICING.ladder;

  /** Only digits are accepted and a number above the limit becomes the limit (as on the subscription page). */
  function onCountChange(value: string) {
    const digits = value.replace(/\D/g, "");
    setRaw(digits === "" ? "" : String(Math.min(Number(digits), max)));
  }

  return (
    <div className="rounded-card border border-line bg-surface p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-fg">{t("landing.calc.title")}</h3>
      <div className="mt-4 grid items-end gap-6 sm:grid-cols-2">
        <TextField
          label={t("landing.calc.label")}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={raw}
          onChange={(event) => onCountChange(event.target.value)}
          onBlur={() => raw === "" && setRaw("0")}
          error={raw !== "" && !valid ? t("landing.calc.error", { max }) : undefined}
          hint={t("landing.calc.max", { max })}
        />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div aria-live="polite">
            <div className="text-sm text-fg-muted">
              {t("landing.calc.total", { days: APP_CONFIG.limits.subscriptionDays })}
            </div>
            <div className="text-3xl font-bold text-fg">{valid ? money(total) : "—"}</div>
            {valid && (
              <div className="text-sm text-fg-muted">
                {t("landing.calc.avg", { amount: money(Math.round(total / count)) })}
              </div>
            )}
          </div>
          {valid ? (
            <Link
              href={signedIn ? `${settingsHref("subscription")}?cases=${count}` : ROUTES.login}
              className={buttonClass()}
            >
              {t("landing.calc.cta")}
            </Link>
          ) : (
            <span aria-disabled="true" className={`${buttonClass({ variant: "secondary" })} cursor-not-allowed opacity-60`}>
              {t("landing.calc.cta")}
            </span>
          )}
        </div>
      </div>
      <p className="mt-4 text-xs text-fg-muted">
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
