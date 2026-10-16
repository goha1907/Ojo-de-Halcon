import type { MessageKey, TranslateFn } from "@ojo/shared";
import { GlobeIcon, IdCardIcon, MailIcon, ScalesIcon } from "@ojo/ui";
import type { ComponentType, SVGProps } from "react";

const SOURCES: ReadonlyArray<{ key: MessageKey; icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  { key: "landing.sources.migraciones", icon: GlobeIcon },
  { key: "landing.sources.renaper", icon: IdCardIcon },
  { key: "landing.sources.pjn", icon: ScalesIcon },
  { key: "landing.sources.correo", icon: MailIcon },
];

/** Running line of what the service follows. The list is doubled so the loop has no seam. */
export function SourcesStrip({ t }: { t: TranslateFn }) {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="flex items-center gap-6 border-y border-line py-5">
        <span className="hidden shrink-0 font-mono text-xs uppercase tracking-wider text-fg-muted sm:block">
          {t("landing.sources.short")}
        </span>
        <div className="flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          <ul className="marquee-track flex w-max gap-11">
            {[0, 1].flatMap((copy) =>
              SOURCES.map(({ key, icon: Icon }) => (
                <li
                  key={`${copy}-${key}`}
                  aria-hidden={copy === 1}
                  className="flex items-center gap-2.5 whitespace-nowrap text-base font-semibold text-fg-muted"
                >
                  <Icon className="size-[22px] text-fg" />
                  {t(key)}
                </li>
              )),
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
