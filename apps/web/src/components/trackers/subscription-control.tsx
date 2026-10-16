"use client";

import { API_ROUTES } from "@ojo/shared";
import { Button } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";

interface Props {
  trackerId: string;
  status: "PENDING_CONFIRMATION" | "ACTIVE" | "FINISHED" | "PAUSED";
  /** false: marked for removal at the end of the period. */
  kept: boolean;
  /** A subscription period is running. */
  subscribed: boolean;
  /** End of the running period (ISO). */
  periodEnd: string | null;
}

/** What the user can do with a case in the subscription: take it out, bring it back, resume it. */
export function SubscriptionControl({ trackerId, status, kept, subscribed, periodEnd }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (status === "PENDING_CONFIRMATION") return null;
  if (status === "FINISHED") {
    return subscribed ? (
      <p className="rounded-field border border-error-fg/25 bg-error-bg px-3 py-2 text-sm font-medium text-error-fg">
        {t("track.sub.finished")}
      </p>
    ) : null;
  }
  if (!subscribed) return null;

  async function act(action: "remove" | "restore" | "resume") {
    setBusy(true);
    setError("");
    try {
      await apiRequest(API_ROUTES.billingCases, { method: "PUT", body: { trackerId, action } });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError && e.code === "NO_FREE_SLOT" ? t("track.sub.noSlot") : describeApiError(e, t));
    } finally {
      setBusy(false);
    }
  }

  const date = periodEnd
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(periodEnd))
    : "";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
      <Button
        variant="secondary"
        loading={busy}
        onClick={() => void act(status === "PAUSED" ? "resume" : kept ? "remove" : "restore")}
      >
        {status === "PAUSED" ? t("track.sub.resume") : kept ? t("track.sub.remove") : t("track.sub.restore")}
      </Button>
      {status === "PAUSED" && <span>{t("track.sub.paused")}</span>}
      {status !== "PAUSED" && !kept && (
        <span className="font-medium text-warning-fg">{t("track.sub.removing", { date })}</span>
      )}
      {error && <span className="text-error-fg">{error}</span>}
    </div>
  );
}
