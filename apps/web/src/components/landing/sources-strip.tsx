import type { TranslateFn } from "@ojo/shared";
import { GlobeIcon, IdCardIcon, MailIcon, ScalesIcon, StarIcon, cn } from "@ojo/ui";
import type { ComponentType, SVGProps } from "react";

/**
 * Services we track today. The names are proper names, not translated. A tile shows the official logo when
 * `logo` points to a file in `public/partners/`; until then it draws a lockup (icon and name).
 * The list is the beginning: more services will be added, and the strip can become "Partners" later.
 */
const PARTNERS: ReadonlyArray<{
  id: string;
  name: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  logo?: string;
}> = [
  { id: "migraciones", name: "Migraciones", icon: GlobeIcon },
  { id: "renaper", name: "RENAPER", icon: IdCardIcon },
  { id: "pjn", name: "PJN", icon: ScalesIcon },
  { id: "correo", name: "Correo Argentino", icon: MailIcon },
];

const TILE = "flex h-14 items-center gap-3 whitespace-nowrap rounded-field border border-line bg-surface px-5";

/** Running line of the services we already track, ending with a note that this is only the start. */
export function SourcesStrip({ t }: { t: TranslateFn }) {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="flex items-center gap-6 border-y border-line py-5">
        <span className="hidden shrink-0 font-mono text-xs uppercase tracking-wider text-fg-muted sm:block">
          {t("landing.sources.short")}
        </span>
        <div className="flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
          <ul className="marquee-track flex w-max gap-4">
            {[0, 1].flatMap((copy) => [
              ...PARTNERS.map(({ id, name, icon: Icon, logo }) => (
                <li key={`${copy}-${id}`} aria-hidden={copy === 1} className={TILE}>
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt={name} className="h-7 w-auto" />
                  ) : (
                    <>
                      <Icon className="size-6 text-fg" />
                      <span className="text-lg font-bold tracking-tight text-fg">{name}</span>
                    </>
                  )}
                </li>
              )),
              <li
                key={`${copy}-more`}
                aria-hidden={copy === 1}
                className={cn(TILE, "border-dashed bg-transparent text-fg-muted")}
              >
                <StarIcon className="size-5" />
                <span className="text-base font-semibold">{t("landing.sources.more")}</span>
              </li>,
            ])}
          </ul>
        </div>
      </div>
    </div>
  );
}
