"use client";

import type { AccessState } from "@ojo/core";
import { API_ROUTES, type MessageKey } from "@ojo/shared";
import { Alert, Button, Card } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";

const PLAN_KEY: Record<AccessState["plan"], MessageKey> = {
  none: "settings.access.none",
  trial: "settings.access.trial",
  trial_expired: "settings.access.trialExpired",
  subscription: "settings.access.subscription",
};

type StubAction = "activate" | "cancel" | "resetTrial";

/** Subscription / trial status plus the test buttons while payments are stubbed. */
export function AccessCard({ access, stubEnabled }: { access: AccessState; stubEnabled: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<StubAction | null>(null);
  const date = access.until
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(access.until))
    : "";

  async function run(action: StubAction) {
    setBusy(action);
    try {
      await apiRequest(API_ROUTES.billingStub, { method: "POST", body: { action } });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title={t("settings.access.title")}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">{t(PLAN_KEY[access.plan], { date })}</p>
        {stubEnabled ? (
          <Alert tone="info">
            <div className="space-y-3">
              <p>
                <strong>{t("settings.access.stubTitle")}.</strong> {t("settings.access.stubHelp")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button loading={busy === "activate"} onClick={() => void run("activate")}>
                  {t("settings.access.stubActivate")}
                </Button>
                <Button variant="secondary" loading={busy === "cancel"} onClick={() => void run("cancel")}>
                  {t("settings.access.stubCancel")}
                </Button>
                <Button variant="secondary" loading={busy === "resetTrial"} onClick={() => void run("resetTrial")}>
                  {t("settings.access.stubReset")}
                </Button>
              </div>
            </div>
          </Alert>
        ) : (
          access.plan !== "subscription" && <p className="text-sm text-slate-500">{t("settings.access.payment")}</p>
        )}
      </div>
    </Card>
  );
}
