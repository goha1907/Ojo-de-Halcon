"use client";

import { API_ROUTES, APP_CONFIG } from "@ojo/shared";
import { cn } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";
import { TONE_STYLES, type StatusTone } from "@/lib/status-tones";

interface Props {
  id: string;
  /** Colour of the card edge: the state of the tracking at a glance. */
  tone: StatusTone;
  /** The user's own name of the tracking, if any. */
  label: string | null;
  /** The official number shown next to the name. */
  number: string;
  /** Short status shown in the folded header. */
  summary: ReactNode;
  renameTitle: string;
  toggleTitle: string;
  /** Always visible at the bottom, under the unfolded body: subscription control, date added, replacement info. */
  strip: ReactNode;
  children: ReactNode;
}

const ICON_BUTTON = "rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50";
const ICON_NEUTRAL = `${ICON_BUTTON} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const ICON_PRIMARY = `${ICON_BUTTON} border-brand-600 bg-brand-600 text-white hover:bg-brand-700`;

/** Folding frame of a tracking card: clickable header with an in-place rename, body below. */
export function DniCardShell({ id, tone, label, number, summary, renameTitle, toggleTitle, strip, children }: Props) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label ?? "");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function startEdit() {
    setValue(label ?? "");
    setEditing(true);
    // focus after the input is rendered
    setTimeout(() => input.current?.select(), 0);
  }

  async function save() {
    if (busy) return;
    if (value.trim() === (label ?? "")) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await apiRequest(`${API_ROUTES.trackers}/${id}/label`, { method: "PUT", body: { label: value } });
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-l-4 border-slate-200 bg-white shadow-sm",
        TONE_STYLES[tone].edge,
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        title={toggleTitle}
        onClick={() => !editing && setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (!editing && event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            setOpen((current) => !current);
          }
        }}
        className={cn(
          "flex select-none flex-wrap items-center gap-3 px-5 py-3.5",
          editing ? "cursor-default" : "cursor-pointer hover:bg-slate-50",
        )}
      >
        <span aria-hidden="true" className={cn("w-3.5 text-slate-400 transition-transform", !open && "-rotate-90")}>
          ▾
        </span>
        <div className="flex min-w-[12rem] flex-1 items-baseline gap-2 text-base font-bold text-slate-900">
          {editing ? (
            <input
              ref={input}
              value={value}
              maxLength={APP_CONFIG.limits.labelMaxLength}
              placeholder={t("track.label.title")}
              aria-label={t("track.label.title")}
              disabled={busy}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") void save();
                if (event.key === "Escape") setEditing(false);
              }}
              className="w-full min-w-0 max-w-sm rounded-lg border border-slate-300 px-2.5 py-1 text-base font-bold text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600"
            />
          ) : (
            label && <span>{label}</span>
          )}
          <small className="whitespace-nowrap font-medium text-slate-500">№ {number}</small>
        </div>
        {!editing && <span className="whitespace-nowrap text-xs text-slate-500">{summary}</span>}
        {editing ? (
          <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              title={t("track.label.save")}
              aria-label={t("track.label.save")}
              disabled={busy}
              onClick={() => void save()}
              className={ICON_PRIMARY}
            >
              ✓
            </button>
            <button
              type="button"
              title={t("common.cancel")}
              aria-label={t("common.cancel")}
              disabled={busy}
              onClick={() => setEditing(false)}
              className={ICON_NEUTRAL}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            title={renameTitle}
            aria-label={renameTitle}
            onClick={(event) => {
              event.stopPropagation();
              startEdit();
            }}
            className={ICON_NEUTRAL}
          >
            ✎
          </button>
        )}
      </div>
      {open && <div className="border-t border-slate-200">{children}</div>}
      <div className="border-t border-slate-200 px-5 py-2.5 empty:hidden">{strip}</div>
    </section>
  );
}
