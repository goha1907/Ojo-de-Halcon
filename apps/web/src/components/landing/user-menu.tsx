"use client";

import { ROUTES } from "@ojo/shared";
import { ChevronDownIcon, cn } from "@ojo/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { LogoutButton } from "@/components/logout-button";
import { AddTrackerButton } from "@/components/trackers/add-tracker-button";
import { formatMoney } from "@/lib/money";
import { isActive } from "@/lib/navigation";

export interface UserMenuStats {
  paid: number;
  used: number;
  free: number;
  price: number;
  currency: string;
}

const SETTINGS_LINKS = [
  { href: ROUTES.settingsProfile, label: "nav.settings.profile" },
  { href: ROUTES.settingsNotifications, label: "nav.settings.notifications" },
  { href: ROUTES.settingsSubscription, label: "nav.settings.subscription" },
] as const;

const ITEM =
  "block rounded-field px-3 py-2 text-sm font-medium text-fg transition-colors hover:bg-line/40 focus-visible:outline-2 focus-visible:outline-ring";
const ITEM_ACTIVE = "bg-line/70";

/**
 * The signed-in visitor's chip in the public header and its drop-down: places and price of the
 * subscription, links into the cabinet, "+ tracking", sign out.
 * `stats` is null when the cabinet is not open yet (e-mail not confirmed, onboarding unfinished).
 */
export function UserMenu({
  email,
  name,
  stats,
}: {
  email: string;
  name: string | null;
  stats: UserMenuStats | null;
}) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const label = name ?? email.split("@")[0] ?? email;
  const initial = (label[0] ?? "?").toUpperCase();

  // a click outside or Escape closes the menu; Escape also returns the focus to the chip
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  const money = (amount: number, currency: string) => formatMoney(amount, currency, locale);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={t("account.menu")}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface pl-[3px] pr-2 transition hover:border-fg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:pr-3"
      >
        <span className="grid size-8 place-items-center rounded-full bg-brand text-sm font-bold text-brand-fg">{initial}</span>
        <span className="hidden max-w-[9rem] truncate text-sm font-medium text-fg sm:block">{label}</span>
        <ChevronDownIcon className={cn("size-4 text-fg-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          id="account-menu"
          className="absolute right-0 z-40 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] space-y-3 rounded-card border border-line bg-surface p-3 shadow-xl"
        >
          <div className="px-2 pt-1">
            {name && <div className="truncate text-sm font-semibold text-fg">{name}</div>}
            <div className="truncate text-xs text-fg-muted">{email}</div>
          </div>

          {stats && (
            <div className="space-y-2 rounded-field bg-bg-subtle p-3">
              <dl className="grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ["settings.sub.bought", stats.paid],
                    ["settings.sub.used", stats.used],
                    ["settings.sub.free", stats.free],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key}>
                    <dd className="text-lg font-bold text-fg">{value}</dd>
                    <dt className="text-[11px] leading-tight text-fg-muted">{t(key)}</dt>
                  </div>
                ))}
              </dl>
              {stats.price > 0 && (
                <div className="flex items-baseline justify-between gap-2 border-t border-line pt-2 text-xs text-fg-muted">
                  <span>{t("settings.sub.sum")}</span>
                  <span className="text-sm font-semibold text-fg">{money(stats.price, stats.currency)}</span>
                </div>
              )}
            </div>
          )}

          <nav className="space-y-0.5" aria-label={t("account.menu")}>
            <Link
              href={ROUTES.dashboard}
              onClick={close}
              aria-current={isActive(pathname, ROUTES.dashboard) ? "page" : undefined}
              className={cn(ITEM, isActive(pathname, ROUTES.dashboard) && ITEM_ACTIVE)}
            >
              {t("nav.dashboard")}
            </Link>
            {stats &&
              SETTINGS_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={close}
                  aria-current={isActive(pathname, href) ? "page" : undefined}
                  className={cn(ITEM, isActive(pathname, href) && ITEM_ACTIVE)}
                >
                  {t(label)}
                </Link>
              ))}
          </nav>

          {stats && (
            // the button asks the page's add-tracking modal to open; the menu steps aside
            <div onClick={close}>
              <AddTrackerButton fullWidth />
            </div>
          )}

          <LogoutButton variant="secondary" fullWidth />
        </div>
      )}
    </div>
  );
}
