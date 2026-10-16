import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { cn } from "../lib/cn";
import { Select } from "./select";
import type { SelectOption } from "./select-logic";

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
          "block w-full rounded-field border bg-surface px-3 py-2 text-sm text-fg shadow-sm",
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

export interface SelectFieldProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  error?: string | undefined;
  hint?: ReactNode;
  disabled?: boolean;
  name?: string;
  className?: string;
}

/** Labeled drop-down list (the project's own, see `Select`); `placeholder` shows while the value is empty. */
export function SelectField({ label, error, hint, className, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <Select id={id} invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={className} {...rest} />
    </FieldShell>
  );
}
