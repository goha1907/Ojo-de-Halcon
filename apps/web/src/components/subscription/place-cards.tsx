"use client";

import type { AccessState, BillingStateDto } from "@ojo/core";
import { Card } from "@ojo/ui";
import { useI18n } from "@/components/providers/i18n-provider";
import { StatTile } from "@/components/stat-tile";

/** Numeric, so the date stays on one line in the narrow tile. */
function shortDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

/**
 * Bonus places (gifts, bonuses, promos): places, how many hold cases, how many are free, and the nearest end with
 * how many places switch off then (after that day the numbers move to the next end). Shown only to accounts that
 * have bonus places. One component for the dashboard and the subscription page, so they always say the same.
 */
export function BonusPlacesCard({ access, billing }: { access: AccessState; billing: BillingStateDto }) {
  const { t, locale } = useI18n();
  if (access.giftCases <= 0) return null;
  const day = (iso: string) => shortDate(iso, locale);
  const next = access.giftNextEnd;
  return (
    <Card title={t("settings.sub.giftTitle")} description={t("settings.sub.giftNote")}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t("settings.sub.giftPlaces")} value={access.giftCases} tone="slots" />
        <StatTile label={t("settings.sub.used")} value={billing.grantedUsedCases} tone="finished" />
        <StatTile label={t("settings.sub.free")} value={access.giftCases - billing.grantedUsedCases} tone="tracking" />
        <StatTile
          label={t("settings.sub.giftUntil")}
          value={next ? day(next.until) : t("settings.sub.giftNoEnd")}
          hint={next ? t("settings.sub.giftEnds", { count: next.cases }) : t("settings.sub.giftNoEndHint")}
        />
      </div>
    </Card>
  );
}

/**
 * Places of the paid subscription. "Switch off next period" is the paid places the next period does not renew:
 * the free ones plus those the owner switched off by hand.
 */
export function SubscriptionPlacesCard({ billing, until }: { billing: BillingStateDto; until: string | null }) {
  const { t, locale } = useI18n();
  const off = Math.max(0, billing.paidCases - billing.nextPeriodCases);
  return (
    <Card title={t("settings.sub.slots")}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t("settings.sub.bought")} value={billing.paidCases} tone="slots" />
        <StatTile label={t("settings.sub.used")} value={billing.paidUsedCases} tone="finished" />
        <StatTile label={t("settings.sub.free")} value={Math.max(0, billing.paidCases - billing.paidUsedCases)} tone="tracking" />
        <StatTile
          label={t("settings.sub.disabledNext")}
          value={off}
          hint={off > 0 && until ? shortDate(until, locale) : undefined}
          tone="removing"
        />
      </div>
    </Card>
  );
}
