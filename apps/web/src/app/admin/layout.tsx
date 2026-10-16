import { can, ROUTES } from "@ojo/shared";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ADMIN_NAV } from "@/components/admin/nav";
import { AdminSignOut } from "@/components/admin/sign-out";
import { ThemeSwitch } from "@/components/landing/preference-selectors";
import { requireStaff } from "@/server/session";

const THEME_LABELS = {
  "theme.label": "Colour theme",
  "theme.system": "Follow the system",
  "theme.light": "Light",
  "theme.dark": "Dark",
} as const;

export const metadata: Metadata = { title: "Admin · Ojo de Halcón", robots: { index: false, follow: false } };

/** Admin area: English only, staff only. Customers and visitors get a plain "not found". */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  const items = ADMIN_NAV.filter((item) => can(staff.role, item.permission));
  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="font-semibold text-fg">
              Ojo de Halcón · Admin
            </Link>
            <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-brand-fg">{staff.role}</span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3 text-sm text-fg-muted">
            <span className="truncate">{staff.email}</span>
            <ThemeSwitch labels={THEME_LABELS} />
            <Link href={ROUTES.dashboard} className="rounded-field border border-line px-3 py-1 hover:bg-line/40">
              Back to the app
            </Link>
            <AdminSignOut />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2" aria-label="Admin sections">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-field px-3 py-1.5 text-sm text-fg hover:bg-line/40">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
