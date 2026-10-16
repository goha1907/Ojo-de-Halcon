import type { MessageKey, TranslateFn } from "@ojo/shared";

const QUESTIONS = [1, 2, 3, 4, 5, 6] as const;

/** Accordion on native <details>: works without JavaScript and with the keyboard. */
export function Faq({ t }: { t: TranslateFn }) {
  return (
    <section id="faq" className="scroll-mt-20 bg-surface">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-16">
        <h2 className="text-2xl font-bold text-fg">{t("landing.faq.title")}</h2>
        <div className="divide-y divide-line rounded-2xl border border-line">
          {QUESTIONS.map((n) => (
            <details key={n} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-fg [&::-webkit-details-marker]:hidden">
                {t(`landing.faq.${n}.q` as MessageKey)}
                <span aria-hidden="true" className="text-fg-subtle transition-transform group-open:rotate-180">▾</span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-fg-muted">{t(`landing.faq.${n}.a` as MessageKey)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
