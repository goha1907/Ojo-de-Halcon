import { ROUTES, type TranslateFn } from "@ojo/shared";
import { ArrowRightIcon } from "@ojo/ui";
import Link from "next/link";

export function FinalCta({ t, signedIn }: { t: TranslateFn; signedIn: boolean }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-4 pt-8">
      <div className="reveal relative overflow-hidden rounded-card bg-brand px-6 py-16 text-center text-brand-fg">
        <div
          aria-hidden="true"
          className="hawk-mask absolute right-[clamp(0.5rem,3%,3rem)] top-1/2 h-[94%] -translate-y-1/2 -scale-x-100 opacity-[0.14] sm:opacity-20"
        />
        <div className="relative space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.final.title")}</h2>
          <p className="mx-auto max-w-[46ch] opacity-85">{t("landing.final.text")}</p>
          <Link
            href={signedIn ? ROUTES.dashboard : ROUTES.register}
            className="btn-shine inline-flex items-center gap-2 rounded-btn bg-brand-fg px-7 py-3.5 text-base font-semibold text-brand transition duration-200 hover:opacity-90 active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-fg"
          >
            {signedIn ? t("landing.cta.cabinet") : t("landing.cta.start")}
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}
