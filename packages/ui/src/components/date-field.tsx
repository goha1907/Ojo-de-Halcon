import { useId } from "react";
import { cn } from "../lib/cn";

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

const SELECT_BASE =
  "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm " +
  "focus:outline-2 focus:outline-offset-0 focus:outline-brand-600";

/**
 * Date entered with three dropdowns (day / month / year): the format cannot
 * be typed wrong. Picking a shorter month or a non-leap year drops an
 * out-of-range day instead of keeping an impossible date.
 */
export function DateField({ label, value, onChange, labels, monthNames, years, daysInMonth, error }: DateFieldProps) {
  const id = useId();
  const border = error ? "border-red-400" : "border-slate-300";
  const yearNumber = value.year ? Number(value.year) : null;
  const monthNumber = value.month ? Number(value.month) : null;
  const dayCount = monthNumber ? daysInMonth(yearNumber, monthNumber) : 31;

  // Keep a saved value selectable even if it falls outside the offered range.
  const yearOptions = yearNumber && !years.includes(yearNumber) ? [yearNumber, ...years] : years;

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
      <legend className="text-sm font-medium text-slate-800">{label}</legend>
      <div className="grid grid-cols-[1fr_1.6fr_1.1fr] gap-2">
        <select
          aria-label={labels.day}
          aria-invalid={Boolean(error)}
          autoComplete="bday-day"
          className={cn(SELECT_BASE, border)}
          value={value.day}
          onChange={(e) => update({ day: e.target.value })}
        >
          <option value="">{labels.day}</option>
          {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
            <option key={day} value={String(day)}>
              {day}
            </option>
          ))}
        </select>
        <select
          aria-label={labels.month}
          aria-invalid={Boolean(error)}
          autoComplete="bday-month"
          className={cn(SELECT_BASE, border)}
          value={value.month}
          onChange={(e) => update({ month: e.target.value })}
        >
          <option value="">{labels.month}</option>
          {monthNames.map((name, index) => (
            <option key={name} value={String(index + 1)}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label={labels.year}
          aria-invalid={Boolean(error)}
          autoComplete="bday-year"
          className={cn(SELECT_BASE, border)}
          value={value.year}
          onChange={(e) => update({ year: e.target.value })}
        >
          <option value="">{labels.year}</option>
          {yearOptions.map((year) => (
            <option key={year} value={String(year)}>
              {year}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}
