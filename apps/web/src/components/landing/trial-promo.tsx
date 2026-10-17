import { APP_CONFIG, type TranslateFn } from "@ojo/shared";
import { GiftIcon, cn } from "@ojo/ui";

/** The free trial offer, made to stand out: a filled badge with the period and what it covers. */
export function TrialPromo({ t, className }: { t: TranslateFn; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-brand/25 bg-surface py-2 pl-2 pr-5 shadow-sm",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-sm font-bold text-brand-fg">
        <GiftIcon className="size-4" />
        {t("landing.promo.badge", { days: APP_CONFIG.limits.trialDays })}
      </span>
      <span className="text-sm font-semibold text-fg">{t("landing.promo.text")}</span>
    </div>
  );
}
