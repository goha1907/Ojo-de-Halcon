"use client";

import type { MessageKey } from "@ojo/shared";
import { cn } from "@ojo/ui";
import { useState, type ReactNode } from "react";
import { useT } from "@/components/providers/i18n-provider";

const STEPS = [1, 2, 3, 4] as const;

/** Small static mock-ups of the real interface, one per step (no screenshots to maintain). */
function Mock({ step }: { step: (typeof STEPS)[number] }) {
  const t = useT();
  const frame = "w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
  const tile = "rounded-xl border border-slate-200 px-3 py-2";
  if (step === 1) {
    return (
      <div className={cn(frame, "space-y-3")}>
        <div className="text-xs font-medium text-slate-500">RENAPER</div>
        <div className={cn(tile, "text-slate-400")}>{t("landing.mock.number")}: 123456789</div>
        <div className="inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
          {t("landing.mock.add")}
        </div>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className={cn(frame, "space-y-3")}>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
          RENAPER · Correo Argentino · PJN
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-2/3 rounded-full bg-brand-600" />
        </div>
        <div className="text-xs text-slate-500">↻</div>
      </div>
    );
  }
  if (step === 3) {
    return (
      <div className={cn(frame, "space-y-1 bg-sky-50")}>
        <div className="text-sm font-semibold text-sky-800">{t("landing.mock.tgTitle")}</div>
        <p className="text-sm leading-6 text-slate-800">{t("landing.mock.tgText")}</p>
      </div>
    );
  }
  return (
    <div className={cn(frame, "space-y-3")}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        RENAPER · {t("landing.mock.status")}
      </div>
      <div className="text-2xl font-extrabold text-slate-900">eDNI exportado</div>
      <div className="text-sm text-slate-500">{t("landing.mock.since", { date: "2026-10-14" })}</div>
      <div className={cn(tile, "text-sm text-slate-700")}>
        <b>Verificación. </b>
        {t("landing.mock.stageText")}
      </div>
    </div>
  );
}

/** Four-step carousel: what the user does and what the service does for them. */
export function HowItWorks(): ReactNode {
  const t = useT();
  const [index, setIndex] = useState(0);
  const step = STEPS[index]!;
  const go = (next: number) => setIndex((next + STEPS.length) % STEPS.length);

  return (
    <section id="how" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-16">
        <h2 className="text-2xl font-bold text-slate-900">{t("landing.how.title")}</h2>
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div className="space-y-4" aria-live="polite">
            <div className="text-sm font-semibold text-brand-600">{t("landing.how.step", { n: step })}</div>
            <h3 className="text-xl font-semibold text-slate-900">
              {t(`landing.how.${step}.title` as MessageKey)}
            </h3>
            <p className="leading-7 text-slate-600">
              {t(`landing.how.${step}.text` as MessageKey)}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label={t("landing.how.prev")}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                ←
              </button>
              <div className="flex gap-2">
                {STEPS.map((n, i) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={t("landing.how.step", { n })}
                    aria-current={i === index}
                    className={cn("h-2.5 w-2.5 rounded-full", i === index ? "bg-brand-600" : "bg-slate-300")}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label={t("landing.how.next")}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                →
              </button>
            </div>
          </div>
          <div className="flex min-h-48 items-center justify-center rounded-2xl bg-slate-50 p-6">
            <Mock step={step} />
          </div>
        </div>
      </div>
    </section>
  );
}
