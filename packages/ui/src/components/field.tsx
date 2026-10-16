import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "../lib/cn";

export interface FieldShellProps {
  id: string;
  label: ReactNode;
  error?: string | undefined;
  hint?: ReactNode;
  children: ReactNode;
}

export function FieldShell({ id, label, error, hint, children }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-fg-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-error-fg">
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
          "block w-full rounded-lg border bg-surface px-3 py-2 text-sm text-fg shadow-sm",
          "placeholder:text-fg-subtle focus:outline-2 focus:outline-offset-0 focus:outline-ring",
          error ? "border-error" : "border-line",
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
          className={cn("mt-0.5 size-4 rounded border-line accent-brand", className)}
          {...rest}
        />
        <label htmlFor={id} className="text-sm text-fg">
          {label}
        </label>
      </div>
      {error && (
        <p role="alert" className="text-xs text-error-fg">
          {error}
        </p>
      )}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: ReactNode;
  options: readonly SelectOption[];
  placeholder?: string;
  error?: string | undefined;
  hint?: ReactNode;
}

/** Labeled dropdown; `placeholder` adds an empty first option. */
export function SelectField({ label, options, placeholder, error, hint, className, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <select
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "block w-full rounded-lg border bg-surface px-3 py-2 text-sm text-fg shadow-sm",
          "focus:outline-2 focus:outline-offset-0 focus:outline-ring",
          error ? "border-error" : "border-line",
          className,
        )}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
