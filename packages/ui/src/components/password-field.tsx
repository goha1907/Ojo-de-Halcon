"use client";

import { useId, useState } from "react";
import { cn } from "../lib/cn";
import { FieldShell, type TextFieldProps } from "./field";

export interface PasswordFieldProps extends Omit<TextFieldProps, "type"> {
  /** Text of the toggle while the password is hidden / shown (also its accessible name). */
  showLabel: string;
  hideLabel: string;
}

/** Password input with a "show / hide" toggle at the end of the field. */
export function PasswordField({ label, error, hint, className, showLabel, hideLabel, ...rest }: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "block w-full rounded-lg border bg-white py-2 pl-3 pr-24 text-sm text-slate-900 shadow-sm",
            "placeholder:text-slate-400 focus:outline-2 focus:outline-offset-0 focus:outline-brand-600",
            error ? "border-red-400" : "border-slate-300",
            className,
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-xs font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          {visible ? hideLabel : showLabel}
        </button>
      </div>
    </FieldShell>
  );
}
