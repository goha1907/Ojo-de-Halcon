import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface CollapsibleCardProps {
  title: ReactNode;
  /** Small colored label shown next to the title (e.g. whose case it is). */
  badge?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/** Card whose body folds under its header (native <details>: no JS, keyboard friendly). */
export function CollapsibleCard({
  title,
  badge,
  description,
  children,
  defaultOpen = true,
  className,
}: CollapsibleCardProps) {
  return (
    <details
      open={defaultOpen}
      className={cn("group rounded-2xl border border-slate-200 bg-white shadow-sm", className)}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-6 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-slate-900">{title}</span>
            {badge}
          </span>
          {description && <span className="block text-sm text-slate-600">{description}</span>}
        </span>
        <span
          aria-hidden="true"
          className="mt-1 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="border-t border-slate-100 p-6 pt-4">{children}</div>
    </details>
  );
}
