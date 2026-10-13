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
  labels: { day: string; month: string; year: string };
  error?: string | undefined;
}

const INPUT_BASE =
  "block w-full rounded-lg border bg-white px-3 py-2 text-center text-sm text-slate-900 shadow-sm " +
  "placeholder:text-slate-400 focus:outline-2 focus:outline-offset-0 focus:outline-brand-600";

/** Date entered as three separate inputs (day / month / year), as on most government forms. */
export function DateField({ label, value, onChange, labels, error }: DateFieldProps) {
  const id = useId();
  const digitsOnly = (raw: string, max: number) => raw.replace(/\D/g, "").slice(0, max);
  const border = error ? "border-red-400" : "border-slate-300";

  return (
    <fieldset className="space-y-1.5" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="text-sm font-medium text-slate-800">{label}</legend>
      <div className="grid grid-cols-[1fr_1fr_1.6fr] gap-2">
        <input
          inputMode="numeric"
          autoComplete="bday-day"
          placeholder={labels.day}
          aria-label={labels.day}
          aria-invalid={Boolean(error)}
          className={cn(INPUT_BASE, border)}
          value={value.day}
          onChange={(e) => onChange({ ...value, day: digitsOnly(e.target.value, 2) })}
        />
        <input
          inputMode="numeric"
          autoComplete="bday-month"
          placeholder={labels.month}
          aria-label={labels.month}
          aria-invalid={Boolean(error)}
          className={cn(INPUT_BASE, border)}
          value={value.month}
          onChange={(e) => onChange({ ...value, month: digitsOnly(e.target.value, 2) })}
        />
        <input
          inputMode="numeric"
          autoComplete="bday-year"
          placeholder={labels.year}
          aria-label={labels.year}
          aria-invalid={Boolean(error)}
          className={cn(INPUT_BASE, border)}
          value={value.year}
          onChange={(e) => onChange({ ...value, year: digitsOnly(e.target.value, 4) })}
        />
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}
