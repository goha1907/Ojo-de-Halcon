import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "btn-shine bg-brand text-brand-fg hover:bg-brand-hover",
  secondary: "border border-line bg-surface text-fg hover:border-fg-subtle hover:bg-line/40",
  ghost: "text-fg-muted hover:bg-line/40 hover:text-fg",
  danger: "bg-error-fg text-bg hover:bg-error-fg/90",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

/** Class list of a button, for links that must look like one (use with next/link). */
export function buttonClass({
  variant = "primary",
  size = "md",
  fullWidth = false,
}: {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
} = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-btn font-medium whitespace-nowrap",
    "transition duration-200 active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:cursor-not-allowed disabled:opacity-60",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth && "w-full",
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
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
      className={cn(buttonClass({ variant, size, fullWidth }), className)}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
