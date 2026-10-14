import { ROUTES, type TranslateFn } from "@ojo/shared";
import Link from "next/link";

export function FinalCta({ t, signedIn }: { t: TranslateFn; signedIn: boolean }) {
  return (
    <section className="bg-brand-600">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-14 text-center">
        <h2 className="text-2xl font-bold text-white">{t("landing.final.title")}</h2>
        <p className="text-brand-50">{t("landing.final.text")}</p>
        <Link
          href={signedIn ? ROUTES.dashboard : ROUTES.register}
          className="inline-flex rounded-lg bg-white px-6 py-3 text-base font-semibold text-brand-700 hover:bg-brand-50"
        >
          {signedIn ? t("landing.cta.cabinet") : t("landing.cta.start")}
        </Link>
      </div>
    </section>
  );
}
