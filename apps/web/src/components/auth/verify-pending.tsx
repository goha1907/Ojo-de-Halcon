"use client";

import { API_ROUTES } from "@ojo/shared";
import { Alert, Button, Card } from "@ojo/ui";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";

/** Shown instead of the app while the e-mail is unverified (when verification is required). */
export function VerifyPending({ email }: { email: string }) {
  const t = useT();
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function resend() {
    setStatus("sending");
    try {
      await apiRequest(API_ROUTES.resendVerification, { method: "POST" });
      setStatus("sent");
    } catch (e) {
      setError(describeApiError(e, t));
      setStatus("error");
    }
  }

  return (
    <Card title={t("auth.verify.pendingTitle")} description={t("auth.verify.pendingText", { email })}>
      <div className="space-y-3">
        {status === "sent" && <Alert tone="success">{t("auth.verify.resent")}</Alert>}
        {status === "error" && <Alert tone="error">{error}</Alert>}
        <Button variant="secondary" loading={status === "sending"} onClick={resend}>
          {t("auth.verify.resend")}
        </Button>
      </div>
    </Card>
  );
}
