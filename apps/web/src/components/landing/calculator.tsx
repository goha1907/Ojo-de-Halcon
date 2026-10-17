"use client";

import { APP_CONFIG, PRICING, ROUTES, casesPrice, settingsHref } from "@ojo/shared";
import { TextInput, buttonClass } from "@ojo/ui";
import Link from "next/link";
import { useId, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { formatMoney } from "@/lib/money";

/** Price of any number of cases, with the ladder spelled out. */
export function Calculator({ signedIn }: { signedIn: boolean }) {
  const { t, locale } = useI18n();
  const inputId = useId();
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

  const error = raw !== "" && !valid ? t("landing.calc.error", { max }) : null;
  // three columns on wide screens, so the field, the total and the button share one row
  // (full class names on purpose: Tailwind only generates classes it can read in the source)
  const cell = {
    label: "sm:[grid-area:label]",
    input: "sm:[grid-area:input]",
    hint: "sm:[grid-area:hint]",
    totlabel: "sm:[grid-area:totlabel]",
    total: "sm:[grid-area:total]",
    avg: "sm:[grid-area:avg]",
    cta: "sm:[grid-area:cta]",
  } as const;

  return (
    <div className="rounded-card border border-line bg-surface p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-fg">{t("landing.calc.title")}</h3>
      <div
        className="mt-5 grid gap-x-8 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:[grid-template-areas:'label_totlabel_._''input_total_cta''hint_avg_._']"
      >
        <label htmlFor={inputId} className={`text-sm font-medium text-fg sm:self-end ${cell.label}`}>
          {t("landing.calc.label")}
        </label>
        <TextInput
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={raw}
          invalid={Boolean(error)}
          aria-describedby={`${inputId}-note`}
          onChange={(event) => onCountChange(event.target.value)}
          onBlur={() => raw === "" && setRaw("0")}
          className={cell.input}
        />
        <p
          id={`${inputId}-note`}
          role={error ? "alert" : undefined}
          className={`text-xs sm:self-start ${error ? "text-error-fg" : "text-fg-muted"} ${cell.hint}`}
        >
          {error ?? t("landing.calc.max", { max })}
        </p>

        <div className={`mt-3 text-sm text-fg-muted sm:mt-0 sm:self-end ${cell.totlabel}`}>
          {t("landing.calc.total", { days: APP_CONFIG.limits.subscriptionDays })}
        </div>
        <div aria-live="polite" className={`text-3xl font-bold leading-none text-fg ${cell.total}`}>
          {valid ? money(total) : "—"}
        </div>
        <div className={`text-sm text-fg-muted sm:self-start ${cell.avg}`}>
          {valid ? t("landing.calc.avg", { amount: money(Math.round(total / count)) }) : " "}
        </div>

        <div className={`mt-2 sm:mt-0 ${cell.cta}`}>
          {valid ? (
            <Link
              href={signedIn ? `${settingsHref("subscription")}?cases=${count}` : ROUTES.login}
              className={buttonClass({ fullWidth: true })}
            >
              {t("landing.calc.cta")}
            </Link>
          ) : (
            <span aria-disabled="true" className={`${buttonClass({ variant: "secondary", fullWidth: true })} cursor-not-allowed opacity-60`}>
              {t("landing.calc.cta")}
            </span>
          )}
        </div>
      </div>
      <p className="mt-5 text-xs text-fg-muted">
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
