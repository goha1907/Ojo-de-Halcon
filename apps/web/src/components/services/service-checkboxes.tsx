"use client";

import { TRACKER_SECTIONS, type MessageKey, type TrackerSection } from "@ojo/shared";
import { CheckboxField } from "@ojo/ui";
import { useT } from "@/components/providers/i18n-provider";

export type ServiceValues = Record<TrackerSection, boolean>;

/** One checkbox per service; reused by onboarding and settings. */
export function ServiceCheckboxes({
  values,
  onChange,
}: {
  values: ServiceValues;
  onChange: (values: ServiceValues) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-3">
      {TRACKER_SECTIONS.map((section) => (
        <CheckboxField
          key={section}
          label={t(`sections.${section}` as MessageKey)}
          checked={values[section]}
          onChange={(e) => onChange({ ...values, [section]: e.target.checked })}
        />
      ))}
    </div>
  );
}
