"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@ojo/ui";
import { LabelEditor } from "./label-editor";

interface Props {
  id: string;
  label: string | null;
  title: ReactNode;
  /** Short status shown in the folded header. */
  summary: ReactNode;
  renameTitle: string;
  toggleTitle: string;
  /** Always visible at the bottom, under the unfolded body: subscription control, date added, replacement info. */
  strip: ReactNode;
  children: ReactNode;
}

/** Folding frame of a DNI card: clickable header with a rename button, body below. */
export function DniCardShell({ id, label, title, summary, renameTitle, toggleTitle, strip, children }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        title={toggleTitle}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
        className={cn(
          "flex cursor-pointer select-none flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-slate-50",
        )}
      >
        <span aria-hidden="true" className={cn("w-3.5 text-slate-400 transition-transform", !open && "-rotate-90")}>
          ▾
        </span>
        <div className="min-w-[12rem] flex-1 text-base font-bold text-slate-900">{title}</div>
        <span className="whitespace-nowrap text-xs text-slate-500">{summary}</span>
        <button
          type="button"
          title={renameTitle}
          aria-label={renameTitle}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
            setEditing((value) => !value);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          ✎
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-200">
          {editing && (
            <div className="border-b border-slate-200 px-5 py-4">
              <LabelEditor id={id} current={label} />
            </div>
          )}
          {children}
        </div>
      )}
      <div className="border-t border-slate-200 px-5 py-2.5 empty:hidden">{strip}</div>
    </section>
  );
}
