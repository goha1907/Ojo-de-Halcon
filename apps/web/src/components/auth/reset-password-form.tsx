"use client";

import { API_ROUTES, APP_CONFIG, ROUTES, resetPasswordSchema } from "@ojo/shared";
import { Alert, Button, Card } from "@ojo/ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PasswordField } from "@/components/password-field";
import { useT } from "@/components/providers/i18n-provider";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { issuesToFieldErrors } from "@/lib/form-errors";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useT();
  const [values, setValues] = useState({ password: "", passwordConfirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  if (done) {
    return (
      <Card title={t("auth.reset.title")}>
        <div className="space-y-4">
          <Alert tone="success">{t("auth.reset.done")}</Alert>
          <Link href={ROUTES.login} className="text-sm font-medium text-brand-600 hover:underline">
            {t("auth.reset.toLogin")}
          </Link>
        </div>
      </Card>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const payload = { token, ...values };
    const parsed = resetPasswordSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues, t));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await apiRequest(API_ROUTES.resetPassword, { method: "POST", body: payload });
      setDone(true);
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.code === "INVALID_TOKEN" ? t("auth.reset.invalid") : describeApiError(error, t),
      );
      setLoading(false);
    }
  }

  return (
    <Card title={t("auth.reset.title")}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <PasswordField
          label={t("field.password")}
          autoComplete="new-password"
          hint={t("field.passwordHint", { min: APP_CONFIG.auth.password.minLength })}
          value={values.password}
          error={errors.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
        />
        <PasswordField
          label={t("field.passwordConfirm")}
          autoComplete="new-password"
          value={values.passwordConfirm}
          error={errors.passwordConfirm}
          onChange={(e) => setValues({ ...values, passwordConfirm: e.target.value })}
        />
        <Button type="submit" fullWidth loading={loading}>
          {t("auth.reset.submit")}
        </Button>
      </form>
    </Card>
  );
}
