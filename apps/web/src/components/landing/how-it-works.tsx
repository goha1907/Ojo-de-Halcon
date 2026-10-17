"use client";

import type { MessageKey } from "@ojo/shared";
import { ArrowLeftIcon, ArrowRightIcon, GearIcon, cn } from "@ojo/ui";
import { useState, type ReactNode } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { SectionTitle } from "./section-title";

const STEPS = [1, 2, 3, 4] as const;

/** Small static mock-ups of the real interface, one per step (no screenshots to maintain). */
function Mock({ step }: { step: (typeof STEPS)[number] }) {
  const t = useT();
  const frame = "w-full max-w-md rounded-card border border-line bg-surface p-5 shadow-sm";
  const tile = "rounded-field border border-line px-3 py-2";
  if (step === 1) {
    return (
      <div className={cn(frame, "space-y-3")}>
        <div className="text-xs font-medium text-fg-muted">RENAPER</div>
        <div className={cn(tile, "text-fg-muted")}>{t("landing.mock.number")}: 123456789</div>
        <div className="inline-flex rounded-field bg-brand px-4 py-2 text-sm font-medium text-brand-fg">
          {t("landing.mock.add")}
        </div>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className={cn(frame, "space-y-3")}>
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-success" />
          RENAPER · Correo Argentino · PJN
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line/40">
          <div className="h-full w-2/3 rounded-full bg-brand" />
        </div>
        <div className="text-xs text-fg-muted">↻</div>
      </div>
    );
  }
  if (step === 3) {
    return (
      <div className={cn(frame, "space-y-1 bg-info-bg")}>
        <div className="text-sm font-semibold text-info-fg">{t("landing.mock.tgTitle")}</div>
        <p className="text-sm leading-6 text-fg">{t("landing.mock.tgText")}</p>
      </div>
    );
  }
  return (
    <div className={cn(frame, "space-y-3")}>
      <div className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
        RENAPER · {t("landing.mock.status")}
      </div>
      <div className="text-2xl font-extrabold text-fg">eDNI exportado</div>
      <div className="text-sm text-fg-muted">{t("landing.mock.since", { date: "2026-10-14" })}</div>
      <div className={cn(tile, "text-sm text-fg")}>
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
    <section id="how" className="scroll-mt-20 bg-surface">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-16">
        <SectionTitle icon={GearIcon}>{t("landing.how.title")}</SectionTitle>
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div className="space-y-4">
            {/* every step sits in the same grid cell: the cell is as tall as the tallest one,
                so switching steps never moves the page */}
            <div className="grid" aria-live="polite">
              {STEPS.map((n) => (
                <div
                  key={n}
                  aria-hidden={n !== step}
                  className={cn("col-start-1 row-start-1 space-y-4", n !== step && "invisible")}
                >
                  <div className="text-sm font-semibold text-fg">{t("landing.how.step", { n })}</div>
                  <h3 className="text-xl font-semibold text-fg">
                    {t(`landing.how.${n}.title` as MessageKey)}
                  </h3>
                  <p className="leading-7 text-fg-muted">{t(`landing.how.${n}.text` as MessageKey)}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label={t("landing.how.prev")}
                className="grid size-9 place-items-center rounded-full border border-line text-fg transition hover:border-fg-subtle hover:bg-line/40 active:scale-95"
              >
                <ArrowLeftIcon className="size-4" />
              </button>
              <div className="flex gap-2">
                {STEPS.map((n, i) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={t("landing.how.step", { n })}
                    aria-current={i === index}
                    className={cn("h-2.5 rounded-full transition-all duration-300", i === index ? "w-6 bg-brand" : "w-2.5 bg-line")}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label={t("landing.how.next")}
                className="grid size-9 place-items-center rounded-full border border-line text-fg transition hover:border-fg-subtle hover:bg-line/40 active:scale-95"
              >
                <ArrowRightIcon className="size-4" />
              </button>
            </div>
          </div>
          <div className="grid rounded-card bg-bg-subtle p-6">
            {STEPS.map((n) => (
              <div
                key={n}
                aria-hidden={n !== step}
                className={cn("col-start-1 row-start-1 flex items-center justify-center", n !== step && "invisible")}
              >
                <Mock step={n} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
