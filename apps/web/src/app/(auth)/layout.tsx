import type { ReactNode } from "react";
import { getT } from "@/server/i18n";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = await getT();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="text-2xl font-semibold text-slate-900">{t("app.name")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("app.tagline")}</p>
      </header>
      {children}
    </main>
  );
}
