import { useId } from "react";
import { Select } from "./select";

export interface DateParts {
  day: string;
  month: string;
  year: string;
}

export interface DateFieldProps {
  label: string;
  value: DateParts;
  onChange: (value: DateParts) => void;
  /** Placeholder (first, empty) option of each dropdown. */
  labels: { day: string; month: string; year: string };
  /** Localized month names, January first (12 items). */
  monthNames: readonly string[];
  /** Selectable years, in display order. */
  years: readonly number[];
  /** Days in the chosen month; falls back to 31 until month and year are known. */
  daysInMonth: (year: number | null, month: number) => number;
  error?: string | undefined;
}

/**
 * Date entered with three dropdowns (day / month / year): the format cannot
 * be typed wrong. Picking a shorter month or a non-leap year drops an
 * out-of-range day instead of keeping an impossible date.
 */
export function DateField({ label, value, onChange, labels, monthNames, years, daysInMonth, error }: DateFieldProps) {
  const id = useId();
  const yearNumber = value.year ? Number(value.year) : null;
  const monthNumber = value.month ? Number(value.month) : null;
  const dayCount = monthNumber ? daysInMonth(yearNumber, monthNumber) : 31;

  // Keep a saved value selectable even if it falls outside the offered range.
  const yearOptions = yearNumber && !years.includes(yearNumber) ? [yearNumber, ...years] : years;

  // the first entry of each list is the placeholder: picking it clears that part
  const dayOptions = [{ value: "", label: labels.day }, ...Array.from({ length: dayCount }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))];
  const monthOptions = [{ value: "", label: labels.month }, ...monthNames.map((name, index) => ({ value: String(index + 1), label: name }))];
  const yearChoices = [{ value: "", label: labels.year }, ...yearOptions.map((year) => ({ value: String(year), label: String(year) }))];

  function update(next: Partial<DateParts>) {
    const merged = { ...value, ...next };
    const month = merged.month ? Number(merged.month) : null;
    if (month && merged.day) {
      const limit = daysInMonth(merged.year ? Number(merged.year) : null, month);
      if (Number(merged.day) > limit) merged.day = "";
    }
    onChange(merged);
  }

  return (
    <fieldset className="space-y-1.5" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="text-sm font-medium text-fg">{label}</legend>
      <div className="grid grid-cols-[1fr_1.6fr_1.1fr] gap-2">
        <Select
          aria-label={labels.day}
          invalid={Boolean(error)}
          options={dayOptions}
          value={value.day}
          onChange={(day) => update({ day })}
        />
        <Select
          aria-label={labels.month}
          invalid={Boolean(error)}
          options={monthOptions}
          value={value.month}
          onChange={(month) => update({ month })}
        />
        <Select
          aria-label={labels.year}
          invalid={Boolean(error)}
          options={yearChoices}
          value={value.year}
          onChange={(year) => update({ year })}
        />
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-error-fg">
          {error}
        </p>
      )}
    </fieldset>
  );
}
