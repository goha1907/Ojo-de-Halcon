import { ROUTES } from "@ojo/shared";
import Link from "next/link";
import type { ReactNode } from "react";
import { PreferenceSelectors } from "@/components/landing/preference-selectors";
import { getT } from "@/server/i18n";

/** Sign-in pages: a minimal header (brand left; language and a way home right) over a centered form. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = await getT();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href={ROUTES.home} className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <span aria-hidden="true" className="text-xl">👁</span>
            {t("app.name")}
          </Link>
          <div className="flex items-center gap-3">
            <PreferenceSelectors t={t} currency={false} />
            <Link href={ROUTES.home} className="text-sm font-medium text-slate-700 hover:text-slate-900">
              ← {t("landing.backHome")}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
        <p className="text-center text-sm text-slate-600">{t("app.tagline")}</p>
        {children}
      </main>
    </div>
  );
}
