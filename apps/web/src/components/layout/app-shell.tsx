import type { AccessState } from "@ojo/core";
import { EARLY_ACCESS_SECTIONS, ROUTES } from "@ojo/shared";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { AccessBanner } from "@/components/layout/access-banner";
import { LogoutButton } from "@/components/logout-button";
import { AddTrackerButton } from "@/components/trackers/add-tracker-button";
import { AddTrackerHost } from "@/components/trackers/add-tracker-host";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { PreferenceSelectors } from "@/components/landing/preference-selectors";
import { getT } from "@/server/i18n";

/** Signed-in layout: menu on the left, content on the right (menu folds on small screens). */
export async function AppShell({
  userLabel,
  staff = false,
  earlyAccess = false,
  showMenu,
  defaultJurisdiction,
  access,
  addLock,
  usage,
  defaultBirthDate,
  sectionCounts,
  children,
}: {
  userLabel: string;
  /** Staff accounts get a link to the admin area. */
  staff?: boolean;
  /** May use services that are not open to everyone yet. */
  earlyAccess?: boolean;
  showMenu: boolean;
  defaultJurisdiction: string | null;
  access: AccessState;
  /** Why adding is blocked right now (null = allowed). */
  addLock: "trial" | "expired" | null;
  /** Paid cases in use / paid; null without a subscription. */
  usage: { used: number; limit: number } | null;
  /** Profile birth date (ISO), offered when adding Migraciones cases. */
  defaultBirthDate: string | null;
  /** Cases per section id, shown in the menu. */
  sectionCounts: Record<string, number>;
  children: ReactNode;
}) {
  const { t, locale } = await getT();
  const hiddenSections: readonly string[] = earlyAccess ? [] : EARLY_ACCESS_SECTIONS;

  const brand = (
    <Link href={ROUTES.home} className="flex items-center">
      <Logo alt={t("app.name")} height={32} />
    </Link>
  );
  const account = (
    <div className="space-y-3 border-t border-line pt-3">
      {showMenu && <AddTrackerButton fullWidth />}
      {staff && (
        <Link href="/admin" className="block rounded-field border border-line px-3 py-2 text-center text-sm font-medium text-fg hover:bg-line/40">
          Admin
        </Link>
      )}
      <PreferenceSelectors t={t} />
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-fg-muted">{userLabel}</span>
        <LogoutButton variant="label" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[260px_1fr]">
      {/* Desktop sidebar: pinned to the viewport while the content scrolls */}
      <aside className="hidden border-r border-line bg-surface md:sticky md:top-0 md:flex md:h-screen md:flex-col md:gap-4 md:self-start md:overflow-y-auto md:p-4">
        {brand}
        <div className="flex-1">{showMenu && <SidebarNav counts={sectionCounts} hidden={hiddenSections} />}</div>
        {account}
      </aside>

      {/* Mobile top bar with a folding menu */}
      <header className="border-b border-line bg-surface p-3 md:hidden">
        <div className="flex items-center justify-between">
          {brand}
          <LogoutButton />
        </div>
        {showMenu && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-medium text-fg">{t("nav.menu")}</summary>
            <div className="mt-2 space-y-3">
              <SidebarNav counts={sectionCounts} hidden={hiddenSections} />
              <AddTrackerButton fullWidth />
            </div>
          </details>
        )}
      </header>

      <main className="min-w-0 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {showMenu && <AccessBanner access={access} t={t} locale={locale} />}
          {children}
        </div>
      </main>
      {/* The single "add tracker" modal of the page; all + buttons open it */}
      {showMenu && <AddTrackerHost
          defaultJurisdiction={defaultJurisdiction}
          lock={addLock}
          usage={usage}
          defaultBirthDate={defaultBirthDate}
          earlyAccess={earlyAccess}
        />}
    </div>
  );
}
