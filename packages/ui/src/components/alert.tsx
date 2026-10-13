import type { ReactNode } from "react";
import { cn } from "../lib/cn";

type Tone = "info" | "success" | "error";

const TONE_CLASSES: Record<Tone, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-900",
};

export function Alert({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-lg border px-3 py-2 text-sm", TONE_CLASSES[tone])}>
      {children}
    </div>
  );
}
