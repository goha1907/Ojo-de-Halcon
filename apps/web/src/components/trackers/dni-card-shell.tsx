"use client";

import { API_ROUTES, APP_CONFIG } from "@ojo/shared";
import { cn } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";
import { useT } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";
import { TONE_STYLES, type StatusTone } from "@/lib/status-tones";
import { useSearchWords } from "./search-context";

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

const ICON_BUTTON = "rounded-field border px-3 py-1.5 text-sm disabled:opacity-50";
const ICON_NEUTRAL = `${ICON_BUTTON} border-line bg-surface text-fg hover:bg-line/40`;
const ICON_PRIMARY = `${ICON_BUTTON} border-brand bg-brand text-brand-fg hover:bg-brand-hover`;

/** Folding frame of a tracking card: clickable header with an in-place rename, body below. */
export function DniCardShell({ id, tone, label, number, summary, renameTitle, toggleTitle, strip, children }: Props) {
  const t = useT();
  const router = useRouter();
  const [folded, setOpen] = useState(false);
  // while searching, cards stay open so the matched text is visible
  const searching = useSearchWords().length > 0;
  const open = folded || searching;
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
        "overflow-hidden rounded-card border border-l-4 border-line bg-surface shadow-sm",
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
          editing ? "cursor-default" : "cursor-pointer hover:bg-line/40",
        )}
      >
        <span aria-hidden="true" className={cn("w-3.5 text-fg-subtle transition-transform", !open && "-rotate-90")}>
          ▾
        </span>
        <div className="flex min-w-[12rem] flex-1 items-baseline gap-2 text-base font-bold text-fg">
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
              className="w-full min-w-0 max-w-sm rounded-field border border-line px-2.5 py-1 text-base font-bold text-fg focus-visible:outline-2 focus-visible:outline-ring"
            />
          ) : (
            label && <span>{label}</span>
          )}
          <small className="whitespace-nowrap font-medium text-fg-muted">№ {number}</small>
          <CopyButton text={number} className="self-center" />
        </div>
        {!editing && <span className="whitespace-nowrap text-xs text-fg-muted">{summary}</span>}
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
      {open && <div className="border-t border-line">{children}</div>}
      <div className="border-t border-line px-5 py-2.5 empty:hidden">{strip}</div>
    </section>
  );
}
