import type { MessageKey, TranslateFn } from "@ojo/shared";
import { BellOffIcon, HelpIcon, LayersIcon } from "@ojo/ui";
import { SectionTitle } from "./section-title";
import type { ComponentType, SVGProps } from "react";

const PROBLEMS: ReadonlyArray<{ n: 1 | 2 | 3; icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  { n: 1, icon: LayersIcon },
  { n: 2, icon: BellOffIcon },
  { n: 3, icon: HelpIcon },
];

/** The pain the service removes. */
export function Problem({ t }: { t: TranslateFn }) {
  return (
    <section className="mx-auto max-w-6xl space-y-9 px-4 py-20">
      <SectionTitle icon={HelpIcon} className="reveal">{t("landing.problem.title")}</SectionTitle>
      <div className="grid gap-4 md:grid-cols-3">
        {PROBLEMS.map(({ n, icon: Icon }) => (
          <div
            key={n}
            className="reveal group rounded-card border border-line bg-surface p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-fg-subtle hover:shadow-lg"
          >
            <span className="mb-5 grid size-12 place-items-center rounded-field bg-line/40 text-fg transition duration-300 group-hover:-rotate-6 group-hover:scale-105 group-hover:bg-brand group-hover:text-brand-fg">
              <Icon className="size-6" />
            </span>
            <h3 className="font-semibold text-fg">{t(`landing.problem.${n}.title` as MessageKey)}</h3>
            <p className="mt-2 text-sm leading-6 text-fg-muted">{t(`landing.problem.${n}.text` as MessageKey)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
