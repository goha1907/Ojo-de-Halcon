"use client";

import { API_ROUTES, ROUTES } from "@ojo/shared";
import { Alert, Button, Card, TextField } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";

export function DeleteAccountCard() {
  const t = useT();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiRequest(API_ROUTES.account, { method: "DELETE", body: { password } });
      router.replace(ROUTES.login);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === "INVALID_PASSWORD"
          ? t("settings.account.invalidPassword")
          : describeApiError(e, t),
      );
      setLoading(false);
    }
  }

  return (
    <Card title={t("settings.account.title")} description={t("settings.account.warning")}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label={t("settings.account.passwordLabel")}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" variant="danger" loading={loading} disabled={!password}>
          {t("settings.account.delete")}
        </Button>
      </form>
    </Card>
  );
}
