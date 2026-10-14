import type { MessageKey, TranslateFn } from "@ojo/shared";

const PROBLEMS = [1, 2, 3] as const;
const SOURCES: ReadonlyArray<{ key: MessageKey; soon?: boolean }> = [
  { key: "landing.sources.renaper" },
  { key: "landing.sources.correo" },
  { key: "landing.sources.pjn" },
  { key: "landing.sources.migraciones", soon: true },
];

/** The pain the service removes, and what it follows today. */
export function Problem({ t }: { t: TranslateFn }) {
  return (
    <section className="mx-auto max-w-6xl space-y-10 px-4 py-16">
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900">{t("landing.problem.title")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PROBLEMS.map((n) => (
            <div key={n} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900">{t(`landing.problem.${n}.title` as MessageKey)}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{t(`landing.problem.${n}.text` as MessageKey)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">{t("landing.sources.title")}</h3>
        <ul className="flex flex-wrap gap-2">
          {SOURCES.map((source) => (
            <li
              key={source.key}
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-800"
            >
              {t(source.key)}
              {source.soon && <span className="ml-1.5 text-xs text-slate-400">· {t("landing.sources.soon")}</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
