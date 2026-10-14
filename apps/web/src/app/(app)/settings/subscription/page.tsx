import { AccessCard } from "@/components/settings/access-card";
import { getCore } from "@/server/core";
import { getEnv } from "@/server/env";
import { getT } from "@/server/i18n";
import { requireUser } from "@/server/session";

/** Payments log page size: the whole history, newest first. */
const PAYMENTS_LIMIT = 200;

export default async function SettingsSubscriptionPage() {
  const user = await requireUser();
  const { t } = await getT();
  const core = getCore();
  const [access, billing, payments] = await Promise.all([
    core.access.get(user.id),
    core.billing.state(user.id),
    core.billing.history(user.id, PAYMENTS_LIMIT),
  ]);

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">{t("nav.settings.subscription")}</h1>
      <AccessCard access={access} billing={billing} payments={payments} stubEnabled={getEnv().PAYMENTS_STUB} />
    </>
  );
}
