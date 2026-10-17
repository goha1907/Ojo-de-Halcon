"use client";

import { NEWS_IMAGE_MAX_BYTES } from "@ojo/shared";
import { Select, Spinner, cn } from "@ojo/ui";
import { useRef, useState, type DragEvent } from "react";

const UPLOADED = "__uploaded";
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif";
const REASONS: Record<string, string> = {
  TOO_BIG: `The picture is too big: ${NEWS_IMAGE_MAX_BYTES / 1024 / 1024} MB at most.`,
  NOT_A_PICTURE: "This file is not a picture the site can use. Use PNG, JPG, WebP, GIF or AVIF.",
  NO_FILE: "No file was selected.",
};

/**
 * Cover of a news entry: upload a picture from the computer (click or drop it on the frame) or pick one of the
 * ready illustrations. An uploaded picture is cropped to the card ratio on the server.
 */
export function CoverPicker({
  value,
  onChange,
  covers,
}: {
  /** Address of the cover; an empty string means the default one. */
  value: string;
  onChange: (value: string) => void;
  /** Ready illustrations to choose from. */
  covers: readonly string[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setError("");
    if (file.size > NEWS_IMAGE_MAX_BYTES) return setError(REASONS.TOO_BIG!);
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/news/image", { method: "POST", body });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; reason?: string };
      if (!response.ok || !payload.url) throw new Error(payload.reason ?? "FAILED");
      onChange(payload.url);
    } catch (failure) {
      setError(REASONS[(failure as Error).message] ?? "The picture was not uploaded. Try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    void upload(event.dataTransfer.files[0]);
  }

  // an uploaded picture is not one of the illustrations: it appears in the list as the current choice
  const uploaded = value.startsWith("/api/");
  const illustrations = [
    ...(uploaded ? [{ value: UPLOADED, label: "Uploaded picture" }] : []),
    { value: "", label: "Default cover" },
    ...covers.map((cover) => ({ value: cover, label: cover.slice(6).replace(/\.[a-z]+$/, "").replace(/-/g, " ") })),
  ];

  return (
    <div className="space-y-2 text-sm text-fg-muted">
      <span id="cover-picker-label">Cover picture</span>
      <div className="grid gap-3 sm:grid-cols-[18rem_1fr] sm:items-start">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cn(
            "relative aspect-[1200/630] overflow-hidden rounded-field border-2 border-dashed bg-bg-subtle transition-colors",
            over ? "border-fg" : "border-line",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value || "/news/default.svg"} alt="" className="size-full object-cover" />
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-bg/70">
              <Spinner className="size-6 text-fg" />
            </span>
          )}
          {over && <span className="absolute inset-0 grid place-items-center bg-bg/80 font-medium text-fg">Drop the picture here</span>}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              className="h-10 rounded-full bg-brand px-4 text-sm font-medium text-brand-fg transition hover:bg-brand-hover disabled:opacity-60"
            >
              Upload a picture
            </button>
            {value && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onChange("")}
                className="h-10 rounded-full border border-line px-4 text-sm font-medium text-fg transition hover:bg-line/40 disabled:opacity-60"
              >
                Remove
              </button>
            )}
            <input ref={input} type="file" accept={ACCEPT} hidden onChange={(event) => void upload(event.target.files?.[0])} />
          </div>
          <p className="text-xs">
            Click the button or drop a file on the frame. PNG, JPG, WebP, GIF or AVIF, up to {NEWS_IMAGE_MAX_BYTES / 1024 / 1024} MB.
            It is cropped to 1200×630, so keep the important part in the middle.
          </p>
          {error && (
            <p role="alert" className="text-xs text-error-fg">
              {error}
            </p>
          )}
          <div className="max-w-64 space-y-1">
            <span className="text-xs">…or choose a ready illustration</span>
            <Select
              aria-label="Ready illustration"
              size="sm"
              value={uploaded ? UPLOADED : value}
              onChange={(next) => next !== UPLOADED && onChange(next)}
              options={illustrations}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
