import type { AccessState } from "@ojo/core";
import { settingsHref, type TranslateFn } from "@ojo/shared";
import Link from "next/link";

/** Short note about the trial / paywall shown above every signed-in page. */
export function AccessBanner({ access, t, locale }: { access: AccessState; t: TranslateFn; locale: string }) {
  if (access.plan === "subscription") return null;
  const date = access.until
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(access.until))
    : "";
  const tone =
    access.plan === "none"
      ? "border-warning-fg/25 bg-warning-bg text-warning-fg"
      : "border-info-fg/25 bg-info-bg text-info-fg";
  const text =
    access.plan === "none"
      ? t(access.endedKind && access.endedKind !== "TRIAL" ? "access.banner.giftEnded" : "access.banner.trialExpired")
      : access.giftCases > 0
        ? access.until
          ? t("access.banner.gift", { count: access.giftCases, date })
          : t("access.banner.giftNoEnd", { count: access.giftCases })
        : t("access.banner.trial", { date });
  return (
    <p className={`rounded-lg border px-3 py-2 text-sm ${tone}`}>
      {text}{" "}
      <Link href={settingsHref("subscription")} className="font-medium underline">
        {t("access.banner.link")}
      </Link>
    </p>
  );
}
