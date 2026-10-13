"use client";

import { API_ROUTES, ROUTES } from "@ojo/shared";
import { Alert, Card, Spinner } from "@ojo/ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";

/** Confirms the e-mail link on load (POST, so link prefetchers cannot consume the token). */
export function VerifyEmailAction({ token }: { token: string }) {
  const t = useT();
  const [state, setState] = useState<"pending" | "done" | "invalid">("pending");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    apiRequest(API_ROUTES.verifyEmail, { method: "POST", body: { token } })
      .then(() => setState("done"))
      .catch(() => setState("invalid"));
  }, [token]);

  if (state === "pending") {
    return (
      <Card title={t("auth.verify.pendingTitle")}>
        <Spinner className="size-5 text-slate-500" label={t("common.loading")} />
      </Card>
    );
  }
  if (state === "invalid") {
    return (
      <Card title={t("auth.verify.pendingTitle")}>
        <Alert tone="error">{t("auth.verify.invalid")}</Alert>
      </Card>
    );
  }
  return (
    <Card title={t("auth.verify.doneTitle")} description={t("auth.verify.doneText")}>
      <Link href={ROUTES.dashboard} className="text-sm font-medium text-brand-600 hover:underline">
        {t("auth.verify.toApp")}
      </Link>
    </Card>
  );
}
