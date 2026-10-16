"use client";

import { API_ROUTES, APP_CONFIG, ROUTES, registerSchema } from "@ojo/shared";
import { Alert, Button, Card, CheckboxField, TextField } from "@ojo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PasswordField } from "@/components/password-field";
import { useT } from "@/components/providers/i18n-provider";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { issuesToFieldErrors } from "@/lib/form-errors";

export function RegisterForm() {
  const t = useT();
  const router = useRouter();
  const [values, setValues] = useState({ email: "", password: "", passwordConfirm: "", acceptTerms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues, t));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await apiRequest(API_ROUTES.register, { method: "POST", body: values });
      router.replace(ROUTES.onboarding);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === "EMAIL_TAKEN") {
        setErrors({ email: t("auth.register.emailTaken") });
      } else if (error instanceof ApiError && error.code === "VALIDATION") {
        setErrors(issuesToFieldErrors(error.issues, t));
      } else {
        setFormError(describeApiError(error, t));
      }
      setLoading(false);
    }
  }

  return (
    <Card title={t("auth.register.title")} description={t("auth.register.subtitle")}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField
          label={t("field.email")}
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
        />
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
        <CheckboxField
          label={t("auth.register.consent")}
          checked={values.acceptTerms}
          error={errors.acceptTerms}
          onChange={(e) => setValues({ ...values, acceptTerms: e.target.checked })}
        />
        <Button type="submit" fullWidth loading={loading}>
          {t("auth.register.submit")}
        </Button>
        <p className="text-center text-sm text-fg-muted">
          {t("auth.register.haveAccount")}{" "}
          <Link href={ROUTES.login} className="font-medium text-fg underline underline-offset-2 hover:text-fg-muted">
            {t("auth.register.loginLink")}
          </Link>
        </p>
      </form>
    </Card>
  );
}
