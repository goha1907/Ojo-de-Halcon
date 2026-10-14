import type { AccessState } from "@ojo/core";
import { Card } from "@ojo/ui";
import type { MessageKey, TranslateFn } from "@ojo/shared";

const PLAN_KEY: Record<AccessState["plan"], MessageKey> = {
  none: "settings.access.none",
  trial: "settings.access.trial",
  trial_expired: "settings.access.trialExpired",
  subscription: "settings.access.subscription",
};

/** Subscription / trial status; payment itself is added later. */
export function AccessCard({ access, t, locale }: { access: AccessState; t: TranslateFn; locale: string }) {
  const date = access.until
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(access.until))
    : "";
  return (
    <Card title={t("settings.access.title")}>
      <div className="space-y-1 text-sm text-slate-700">
        <p>{t(PLAN_KEY[access.plan], { date })}</p>
        {access.plan !== "subscription" && <p className="text-slate-500">{t("settings.access.payment")}</p>}
      </div>
    </Card>
  );
}
