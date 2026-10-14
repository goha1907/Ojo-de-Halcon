import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

export function Card({ title, description, children, className, id }: CardProps) {
  return (
    <section id={id} className={cn("scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm", className)}>
      {(title || description) && (
        <header className="mb-4 space-y-1">
          {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
          {description && <p className="text-sm text-slate-600">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
