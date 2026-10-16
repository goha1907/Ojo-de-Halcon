import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-brand text-brand-fg hover:bg-brand-hover",
  secondary:
    "border border-line bg-surface text-fg hover:bg-bg-subtle",
  ghost: "text-fg-muted hover:bg-bg-subtle hover:text-fg",
  danger: "bg-error-fg text-bg hover:bg-error-fg/90",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium",
        "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT_CLASSES[variant],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
