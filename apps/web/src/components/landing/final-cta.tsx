import { ROUTES, type TranslateFn } from "@ojo/shared";
import Link from "next/link";

export function FinalCta({ t, signedIn }: { t: TranslateFn; signedIn: boolean }) {
  return (
    <section className="bg-brand text-brand-fg">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-14 text-center">
        <h2 className="text-2xl font-bold">{t("landing.final.title")}</h2>
        <p className="opacity-80">{t("landing.final.text")}</p>
        <Link
          href={signedIn ? ROUTES.dashboard : ROUTES.register}
          className="inline-flex rounded-lg bg-brand-fg px-6 py-3 text-base font-semibold text-brand hover:opacity-90"
        >
          {signedIn ? t("landing.cta.cabinet") : t("landing.cta.start")}
        </Link>
      </div>
    </section>
  );
}
