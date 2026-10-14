import type { MessageKey, TranslateFn } from "@ojo/shared";

const QUESTIONS = [1, 2, 3, 4, 5, 6] as const;

/** Accordion on native <details>: works without JavaScript and with the keyboard. */
export function Faq({ t }: { t: TranslateFn }) {
  return (
    <section id="faq" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-16">
        <h2 className="text-2xl font-bold text-slate-900">{t("landing.faq.title")}</h2>
        <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {QUESTIONS.map((n) => (
            <details key={n} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                {t(`landing.faq.${n}.q` as MessageKey)}
                <span aria-hidden="true" className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">{t(`landing.faq.${n}.a` as MessageKey)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
