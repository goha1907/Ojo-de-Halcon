import { AccessCard } from "@/components/settings/access-card";
import { getCore } from "@/server/core";
import { nowMs } from "@/lib/days";
import { getEnv } from "@/server/env";
import { getT } from "@/server/i18n";
import { requireUser } from "@/server/session";

/** Payments log page size: the whole history, newest first. */
const PAYMENTS_LIMIT = 200;

export default async function SettingsSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ cases?: string }>;
}) {
  const user = await requireUser();
  // "?cases=N" comes from the pricing section of the landing page
  const requested = Math.trunc(Number((await searchParams).cases));
  const { t } = await getT();
  const core = getCore();
  const [access, billing, payments, grants] = await Promise.all([
    core.access.get(user.id),
    core.billing.state(user.id),
    core.billing.history(user.id, PAYMENTS_LIMIT),
    core.grants.list(user.id),
  ]);

  return (
    <>
      <h1 className="text-xl font-semibold text-fg">{t("nav.settings.subscription")}</h1>
      <AccessCard
        access={access}
        billing={billing}
        payments={payments}
        grants={grants}
        methods={core.payments.methods()}
        testMode={getEnv().PAYMENTS_STUB}
        daysLeft={access.until ? Math.ceil((new Date(access.until).getTime() - nowMs()) / 86_400_000) : 0}
        {...(Number.isFinite(requested) && requested > 0 ? { initialCount: requested } : {})}
      />
    </>
  );
}
