"use client";

import { composeIsoDate, profileSchema, splitIsoDate, type ProfileInput } from "@ojo/shared";
import { DateField, TextField, type DateParts } from "@ojo/ui";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { issuesToFieldErrors } from "@/lib/form-errors";

export interface ProfileValues {
  firstName: string;
  lastName: string;
  birthDate: DateParts;
}

export interface ProfileInitial {
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
}

/** Shared state + validation for the profile inputs (onboarding and settings). */
export function useProfileFields(initial: ProfileInitial) {
  const t = useT();
  const [values, setValues] = useState<ProfileValues>({
    firstName: initial.firstName ?? "",
    lastName: initial.lastName ?? "",
    birthDate: splitIsoDate(initial.birthDate),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const payload = {
    firstName: values.firstName,
    lastName: values.lastName,
    birthDate: composeIsoDate(values.birthDate),
  };

  const isEmpty = !payload.firstName.trim() && !payload.lastName.trim() && !payload.birthDate;

  /** Returns the payload when valid, otherwise shows the errors and returns null. */
  function validate(): typeof payload | null {
    const parsed = profileSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues, t));
      return null;
    }
    setErrors({});
    return payload;
  }

  return { values, setValues, errors, setErrors, isEmpty, validate };
}

export type ProfileFieldsState = ReturnType<typeof useProfileFields>;

export function ProfileFields({ state }: { state: ProfileFieldsState }) {
  const t = useT();
  const { values, setValues, errors } = state;
  return (
    <div className="space-y-4">
      <TextField
        label={t("field.firstName")}
        autoComplete="given-name"
        value={values.firstName}
        error={errors.firstName}
        onChange={(e) => setValues({ ...values, firstName: e.target.value })}
      />
      <TextField
        label={t("field.lastName")}
        autoComplete="family-name"
        value={values.lastName}
        error={errors.lastName}
        onChange={(e) => setValues({ ...values, lastName: e.target.value })}
      />
      <DateField
        label={t("field.birthDate")}
        value={values.birthDate}
        error={errors.birthDate}
        labels={{ day: t("field.day"), month: t("field.month"), year: t("field.year") }}
        onChange={(birthDate) => setValues({ ...values, birthDate })}
      />
    </div>
  );
}

export type { ProfileInput };
