import { cn } from "@ojo/ui";
import type { ComponentType, ReactNode, SVGProps } from "react";

/** A section heading with its brand tile in front: a graphite square with a line icon that fits the section. */
export function SectionTitle({
  icon: Icon,
  children,
  className,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-field bg-brand text-brand-fg shadow-sm sm:size-14">
        <Icon className="size-6 sm:size-7" />
      </span>
      <h2 className="text-balance text-3xl font-bold tracking-tight text-fg sm:text-4xl">{children}</h2>
    </div>
  );
}
