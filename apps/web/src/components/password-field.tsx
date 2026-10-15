"use client";

import { PasswordField as BasePasswordField, type PasswordFieldProps } from "@ojo/ui";
import { useT } from "@/components/providers/i18n-provider";

/** Password input with the translated show / hide toggle. */
export function PasswordField(props: Omit<PasswordFieldProps, "showLabel" | "hideLabel">) {
  const t = useT();
  return <BasePasswordField {...props} showLabel={t("field.passwordShow")} hideLabel={t("field.passwordHide")} />;
}
