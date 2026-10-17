import Link from "next/link";
import type { ReactNode } from "react";

export const TABLE = "w-full text-left text-sm";
export const TH = "px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted";
export const TD = "px-3 py-2 align-top";

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold text-fg">{title}</h1>
      {children}
    </div>
  );
}

export function Panel({ title, children, note }: { title?: string; note?: string; children: ReactNode }) {
  return (
    <section className="rounded-field border border-line bg-surface p-4 shadow-sm">
      {title && <h2 className="mb-3 text-sm font-semibold text-fg">{title}</h2>}
      {note && <p className="mb-3 text-xs text-fg-muted">{note}</p>}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: string; href?: string }) {
  const body = (
    <>
      <div className="text-xs font-medium text-fg-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold text-fg">{value}</div>
      {hint && <div className="mt-1 text-xs text-fg-muted">{hint}</div>}
    </>
  );
  const box = "block rounded-field border border-line bg-surface p-4 shadow-sm";
  return href ? (
    <Link href={href} className={`${box} transition-colors hover:border-brand hover:bg-line/20 focus-visible:outline-2 focus-visible:outline-ring`}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

const BADGE: Record<string, string> = {
  green: "bg-success-bg text-success-fg",
  amber: "bg-warning-bg text-warning-fg",
  red: "bg-error-bg text-error-fg",
  slate: "bg-line/40 text-fg",
  blue: "bg-info-bg text-info-fg",
};

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: keyof typeof BADGE }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[tone]}`}>{children}</span>;
}

/** Previous / next links for a paged list; `href(page)` builds the address. */
export function Pager({ page, pageSize, total, href }: { page: number; pageSize: number; total: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="mt-3 text-xs text-fg-muted">{total} total</p>;
  return (
    <div className="mt-3 flex items-center justify-between text-sm">
      <span className="text-xs text-fg-muted">
        Page {page} of {pages} · {total} total
      </span>
      <span className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className="rounded-field border border-line px-3 py-1 hover:bg-line/40">
            Previous
          </Link>
        ) : (
          <span className="rounded-field border border-line px-3 py-1 text-fg-subtle">Previous</span>
        )}
        {page < pages ? (
          <Link href={href(page + 1)} className="rounded-field border border-line px-3 py-1 hover:bg-line/40">
            Next
          </Link>
        ) : (
          <span className="rounded-field border border-line px-3 py-1 text-fg-subtle">Next</span>
        )}
      </span>
    </div>
  );
}
