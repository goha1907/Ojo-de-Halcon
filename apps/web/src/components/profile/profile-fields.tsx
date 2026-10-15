"use client";

import {
  PJN_JURISDICTIONS,
  birthYearOptions,
  composeIsoDate,
  daysInMonth,
  profileSchema,
  splitIsoDate,
  type ProfileInput,
} from "@ojo/shared";
import { DateField, SelectField, TextField, type DateParts } from "@ojo/ui";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { issuesToFieldErrors } from "@/lib/form-errors";

export interface ProfileValues {
  firstName: string;
  lastName: string;
  birthDate: DateParts;
  pjnJurisdiction: string;
}

export interface ProfileInitial {
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  pjnJurisdiction: string | null;
}

/** Shared state + validation for the profile inputs (onboarding and settings). */
export function useProfileFields(initial: ProfileInitial) {
  const { t } = useI18n();
  const [values, setValues] = useState<ProfileValues>({
    firstName: initial.firstName ?? "",
    lastName: initial.lastName ?? "",
    birthDate: splitIsoDate(initial.birthDate),
    pjnJurisdiction: initial.pjnJurisdiction ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const payload = {
    firstName: values.firstName,
    lastName: values.lastName,
    birthDate: composeIsoDate(values.birthDate),
    pjnJurisdiction: values.pjnJurisdiction,
  };

  const isEmpty =
    !payload.firstName.trim() && !payload.lastName.trim() && !payload.birthDate && !payload.pjnJurisdiction;

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

/** Month names in the interface language, capitalized (Intl, so no hardcoded lists). */
export function localizedMonthNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, month) => {
    const name = format.format(new Date(Date.UTC(2000, month, 1)));
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  });
}

export function ProfileFields({ state }: { state: ProfileFieldsState }) {
  const { t, locale } = useI18n();
  const { values, setValues, errors } = state;
  const monthNames = useMemo(() => localizedMonthNames(locale), [locale]);
  const years = useMemo(() => birthYearOptions(new Date()), []);
  const courts = useMemo(
    () => PJN_JURISDICTIONS.map((item) => ({ value: item.value, label: `${item.code} — ${item.name}` })),
    [],
  );
  return (
    <div className="space-y-4">
      <TextField
        label={t("field.firstNameOptional")}
        autoComplete="given-name"
        value={values.firstName}
        error={errors.firstName}
        onChange={(e) => setValues({ ...values, firstName: e.target.value })}
      />
      <TextField
        label={t("field.lastNameOptional")}
        autoComplete="family-name"
        value={values.lastName}
        error={errors.lastName}
        onChange={(e) => setValues({ ...values, lastName: e.target.value })}
      />
      <DateField
        label={t("field.birthDateOptional")}
        value={values.birthDate}
        error={errors.birthDate}
        labels={{ day: t("field.day"), month: t("field.month"), year: t("field.year") }}
        monthNames={monthNames}
        years={years}
        daysInMonth={daysInMonth}
        onChange={(birthDate) => setValues({ ...values, birthDate })}
      />
      <SelectField
        label={t("field.court")}
        hint={t("field.courtHint")}
        placeholder={t("field.courtPlaceholder")}
        options={courts}
        value={values.pjnJurisdiction}
        error={errors.pjnJurisdiction}
        onChange={(e) => setValues({ ...values, pjnJurisdiction: e.target.value })}
      />
    </div>
  );
}

export type { ProfileInput };
