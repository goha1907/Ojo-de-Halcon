"use client";

import { API_ROUTES, APP_CONFIG, changePasswordSchema } from "@ojo/shared";
import { Alert, Button, Card } from "@ojo/ui";
import { useState, type FormEvent } from "react";
import { PasswordField } from "@/components/password-field";
import { useT } from "@/components/providers/i18n-provider";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { issuesToFieldErrors } from "@/lib/form-errors";

const EMPTY = { currentPassword: "", password: "", passwordConfirm: "" };

/** Password change: the current password is required, other devices are signed out. */
export function ChangePasswordCard() {
  const t = useT();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setDone(false);
    const parsed = changePasswordSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues, t));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await apiRequest(API_ROUTES.changePassword, { method: "PUT", body: values });
      setValues(EMPTY);
      setDone(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === "INVALID_PASSWORD") {
        setErrors({ currentPassword: t("settings.password.invalidCurrent") });
      } else {
        setFormError(describeApiError(error, t));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title={t("settings.password.title")} description={t("settings.password.help")}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        {done && <Alert tone="success">{t("settings.password.done")}</Alert>}
        <PasswordField
          label={t("settings.password.current")}
          autoComplete="current-password"
          value={values.currentPassword}
          error={errors.currentPassword}
          onChange={(e) => setValues({ ...values, currentPassword: e.target.value })}
        />
        <PasswordField
          label={t("settings.password.new")}
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
        <Button type="submit" loading={loading}>
          {t("settings.password.submit")}
        </Button>
      </form>
    </Card>
  );
}
