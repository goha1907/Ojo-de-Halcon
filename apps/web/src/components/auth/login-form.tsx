"use client";

import { API_ROUTES, ROUTES, loginSchema } from "@ojo/shared";
import { Alert, Button, Card, TextField } from "@ojo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { issuesToFieldErrors } from "@/lib/form-errors";

export function LoginForm() {
  const t = useT();
  const router = useRouter();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues, t));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await apiRequest(API_ROUTES.login, { method: "POST", body: values });
      router.replace(ROUTES.dashboard);
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.code === "INVALID_CREDENTIALS"
          ? t("auth.login.invalid")
          : describeApiError(error, t),
      );
      setLoading(false);
    }
  }

  return (
    <Card title={t("auth.login.title")} description={t("auth.login.subtitle")}>
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
        <TextField
          label={t("field.password")}
          type="password"
          autoComplete="current-password"
          value={values.password}
          error={errors.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
        />
        <Button type="submit" fullWidth loading={loading}>
          {t("auth.login.submit")}
        </Button>
        <p className="text-center text-sm">
          <Link href={ROUTES.forgotPassword} className="text-brand-600 hover:underline">
            {t("auth.login.forgot")}
          </Link>
        </p>
        <p className="text-center text-sm text-slate-600">
          {t("auth.login.noAccount")}{" "}
          <Link href={ROUTES.register} className="font-medium text-brand-600 hover:underline">
            {t("auth.login.registerLink")}
          </Link>
        </p>
      </form>
    </Card>
  );
}
