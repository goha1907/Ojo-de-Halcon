import type { ReactNode } from "react";
import { cn } from "../lib/cn";

type Tone = "info" | "success" | "error";

const TONE_CLASSES: Record<Tone, string> = {
  info: "border-info-fg/25 bg-info-bg text-info-fg",
  success: "border-success-fg/25 bg-success-bg text-success-fg",
  error: "border-error-fg/25 bg-error-bg text-error-fg",
};

export function Alert({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-lg border px-3 py-2 text-sm", TONE_CLASSES[tone])}>
      {children}
    </div>
  );
}
