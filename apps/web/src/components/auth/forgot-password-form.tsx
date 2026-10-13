"use client";

import { API_ROUTES, ROUTES, forgotPasswordSchema } from "@ojo/shared";
import { Alert, Button, Card, TextField } from "@ojo/ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { issuesToFieldErrors } from "@/lib/form-errors";

export function ForgotPasswordForm() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues, t));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await apiRequest(API_ROUTES.forgotPassword, { method: "POST", body: { email } });
      setSent(true);
    } catch (error) {
      setFormError(describeApiError(error, t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title={t("auth.forgot.title")} description={t("auth.forgot.subtitle")}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {sent && <Alert tone="success">{t("auth.forgot.sent")}</Alert>}
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField
          label={t("field.email")}
          type="email"
          autoComplete="email"
          value={email}
          error={errors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" fullWidth loading={loading}>
          {t("auth.forgot.submit")}
        </Button>
        <p className="text-center text-sm">
          <Link href={ROUTES.login} className="text-brand-600 hover:underline">
            {t("auth.forgot.back")}
          </Link>
        </p>
      </form>
    </Card>
  );
}
