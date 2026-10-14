"use client";

import { birthYearOptions, daysInMonth } from "@ojo/shared";
import { DateField, type DateParts } from "@ojo/ui";
import { useMemo } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { localizedMonthNames } from "./profile-fields";

/** The three-dropdown birth date picker with the interface's labels (any age: the holder may be a child). */
export function BirthDateField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: DateParts;
  onChange: (value: DateParts) => void;
  error?: string | undefined;
}) {
  const { t, locale } = useI18n();
  const monthNames = useMemo(() => localizedMonthNames(locale), [locale]);
  const years = useMemo(() => birthYearOptions(new Date(), 0), []);
  return (
    <DateField
      label={label}
      value={value}
      error={error}
      labels={{ day: t("field.day"), month: t("field.month"), year: t("field.year") }}
      monthNames={monthNames}
      years={years}
      daysInMonth={daysInMonth}
      onChange={onChange}
    />
  );
}
