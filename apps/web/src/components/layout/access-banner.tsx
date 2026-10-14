import type { AccessState } from "@ojo/core";
import { settingsHref, type MessageKey, type TranslateFn } from "@ojo/shared";
import Link from "next/link";

const KEY: Record<Exclude<AccessState["plan"], "subscription">, MessageKey> = {
  trial: "access.banner.trial",
  trial_expired: "access.banner.trialExpired",
};

/** Short note about the trial / paywall shown above every signed-in page. */
export function AccessBanner({ access, t, locale }: { access: AccessState; t: TranslateFn; locale: string }) {
  if (access.plan === "subscription") return null;
  const date = access.until
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(access.until))
    : "";
  const tone =
    access.plan === "trial_expired"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-sky-200 bg-sky-50 text-sky-900";
  return (
    <p className={`rounded-lg border px-3 py-2 text-sm ${tone}`}>
      {t(KEY[access.plan], { date })}{" "}
      <Link href={settingsHref("subscription")} className="font-medium underline">
        {t("access.banner.link")}
      </Link>
    </p>
  );
}
