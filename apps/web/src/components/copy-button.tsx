"use client";

import { cn } from "@ojo/ui";
import { useState, type MouseEvent } from "react";
import { useT } from "@/components/providers/i18n-provider";

/** Writes text to the clipboard; falls back to a hidden field where the clipboard API is not available. */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }
}

/** Small "copy" icon next to a number: shows a check mark for a moment after copying. */
export function CopyButton({ text, className }: { text: string; className?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function copy(event: MouseEvent) {
    // sits inside clickable headers: copying must not fold or open the card
    event.stopPropagation();
    event.preventDefault();
    if (await writeClipboard(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const label = copied ? t("common.copied") : t("track.copyNumber");
  return (
    <button
      type="button"
      onClick={(event) => void copy(event)}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs",
        copied
          ? "border-success-fg/25 bg-success-bg text-success-fg"
          : "border-line bg-surface text-fg-muted hover:bg-line/40 hover:text-fg",
        className,
      )}
    >
      <span aria-hidden="true">{copied ? "✓" : "⧉"}</span>
    </button>
  );
}
