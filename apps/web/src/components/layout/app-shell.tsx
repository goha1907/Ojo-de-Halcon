import type { PersonDto } from "@ojo/core";
import { ROUTES } from "@ojo/shared";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { AddTrackerButton } from "@/components/trackers/add-tracker-button";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { getT } from "@/server/i18n";

/** Signed-in layout: menu on the left, content on the right (menu folds on small screens). */
export async function AppShell({
  userLabel,
  showMenu,
  defaultJurisdiction,
  people,
  children,
}: {
  userLabel: string;
  showMenu: boolean;
  defaultJurisdiction: string | null;
  people: PersonDto[];
  children: ReactNode;
}) {
  const { t } = await getT();

  const brand = (
    <Link href={ROUTES.dashboard} className="text-lg font-semibold text-slate-900">
      {t("app.name")}
    </Link>
  );
  const account = (
    <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
      <span className="truncate text-sm text-slate-600">{userLabel}</span>
      <LogoutButton />
    </div>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[260px_1fr]">
      {/* Desktop sidebar: pinned to the viewport while the content scrolls */}
      <aside className="hidden border-r border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:flex-col md:gap-4 md:self-start md:overflow-y-auto md:p-4">
        {brand}
        <div className="flex-1">{showMenu && <SidebarNav />}</div>
        {account}
      </aside>

      {/* Mobile top bar with a folding menu */}
      <header className="border-b border-slate-200 bg-white p-3 md:hidden">
        <div className="flex items-center justify-between">
          {brand}
          <LogoutButton />
        </div>
        {showMenu && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">{t("nav.menu")}</summary>
            <div className="mt-2">
              <SidebarNav />
            </div>
          </details>
        )}
      </header>

      <main className="min-w-0 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {showMenu && (
            <div className="flex justify-end">
              <AddTrackerButton defaultJurisdiction={defaultJurisdiction} people={people} />
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
