"use client";

import { useId, useState } from "react";
import { cn } from "../lib/cn";
import { FieldShell, type TextFieldProps } from "./field";
import { EyeIcon, EyeOffIcon } from "./icons";

export interface PasswordFieldProps extends Omit<TextFieldProps, "type"> {
  /** Accessible name and tooltip of the toggle (an icon) while the password is hidden / shown. */
  showLabel: string;
  hideLabel: string;
}

/** Password input with an eye toggle at the end of the field: open eye shows the password, crossed-out eye hides it. */
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
            "block w-full rounded-field border bg-surface py-2 pl-3 pr-12 text-sm text-fg shadow-sm",
            "placeholder:text-fg-subtle focus:outline-2 focus:outline-offset-0 focus:outline-ring",
            error ? "border-error" : "border-line",
            className,
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? hideLabel : showLabel}
          title={visible ? hideLabel : showLabel}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-fg-muted transition-colors hover:bg-line/40 hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
        >
          {visible ? <EyeOffIcon className="size-[18px]" /> : <EyeIcon className="size-[18px]" />}
        </button>
      </div>
    </FieldShell>
  );
}
