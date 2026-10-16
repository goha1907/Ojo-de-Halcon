import { ROUTES, type TranslateFn } from "@ojo/shared";
import { buttonClass } from "@ojo/ui";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LANDING_SECTIONS } from "./sections";
import { PreferenceSelectors } from "./preference-selectors";
import { UserMenu, type UserMenuStats } from "./user-menu";


/** Sticky header: logo, in-page menu, auth buttons. The menu folds into a drop-down on phones. */
export function LandingHeader({
  t,
  user,
}: {
  t: TranslateFn;
  /** The signed-in visitor, or null. `stats` is null while the cabinet is not open to them yet. */
  user: { email: string; name: string | null; stats: UserMenuStats | null } | null;
}) {
  const links = LANDING_SECTIONS.map((section) => (
    <a
      key={section.id}
      href={`#${section.id}`}
      className="rounded-full px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-line/40 hover:text-fg"
    >
      {t(section.labelKey)}
    </a>
  ));
  const auth = user ? (
    <UserMenu email={user.email} name={user.name} stats={user.stats} />
  ) : (
    <>
      <Link href={ROUTES.login} className={buttonClass({ variant: "secondary", size: "sm" })}>
        {t("landing.cta.login")}
      </Link>
      <Link href={ROUTES.register} className={buttonClass({ size: "sm" })}>
        {t("landing.cta.register")}
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href={ROUTES.home} className="flex items-center">
          <Logo alt={t("app.name")} height={36} className="hidden sm:block" />
          <Logo variant="icon" alt={t("app.name")} height={36} className="sm:hidden" />
        </Link>
        <nav aria-label={t("landing.nav.label")} className="ml-4 hidden items-center gap-1 md:flex">
          {links}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden lg:block">
            <PreferenceSelectors t={t} />
          </div>
          {auth}
          <details className="relative md:hidden">
            <summary
              aria-label={t("landing.menu.open")}
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-field border border-line text-lg [&::-webkit-details-marker]:hidden"
            >
              ☰
            </summary>
            <div className="absolute right-0 mt-2 flex w-56 flex-col gap-1 rounded-field border border-line bg-surface p-2 shadow-lg">
              {links}
              <div className="border-t border-line pt-2 lg:hidden">
                <PreferenceSelectors t={t} className="flex-wrap justify-center" />
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
