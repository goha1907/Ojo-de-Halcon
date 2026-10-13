import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { cn } from "../lib/cn";

interface FieldShellProps {
  id: string;
  label: ReactNode;
  error?: string | undefined;
  hint?: ReactNode;
  children: ReactNode;
}

function FieldShell({ id, label, error, hint, children }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: ReactNode;
  error?: string | undefined;
  hint?: ReactNode;
}

/** Labeled input. Works for text, date, email… via the `type` prop. */
export function TextField({ label, error, hint, className, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm",
          "placeholder:text-slate-400 focus:outline-2 focus:outline-offset-0 focus:outline-brand-600",
          error ? "border-red-400" : "border-slate-300",
          className,
        )}
        {...rest}
      />
    </FieldShell>
  );
}

export interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  label: ReactNode;
  error?: string | undefined;
}

export function CheckboxField({ label, error, className, ...rest }: CheckboxFieldProps) {
  const id = useId();
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          aria-invalid={Boolean(error)}
          className={cn("mt-0.5 size-4 rounded border-slate-300 accent-brand-600", className)}
          {...rest}
        />
        <label htmlFor={id} className="text-sm text-slate-700">
          {label}
        </label>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
