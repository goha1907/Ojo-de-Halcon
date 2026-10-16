"use client";

import type { MessageKey } from "@ojo/shared";
import { GlobeIcon, IdCardIcon, MailIcon, SendIcon, cn } from "@ojo/ui";
import { useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type SVGProps } from "react";
import { Logo } from "@/components/brand/logo";
import { useT } from "@/components/providers/i18n-provider";
import { TONE_STYLES, type StatusTone } from "@/lib/status-tones";

/** The DNI row walks through these stages, and the bot "announces" each one. */
const DNI_STAGES: ReadonlyArray<{ key: MessageKey; tone: StatusTone }> = [
  { key: "landing.demo.received", tone: "pending" },
  { key: "landing.demo.printing", tone: "removing" },
  { key: "landing.demo.ready", tone: "tracking" },
];
const STAGE_MS = 3800;
const TOAST_MS = 2600;

type Row = { id: string; icon: ComponentType<SVGProps<SVGSVGElement>>; name: MessageKey; sub: string };
const ROWS: ReadonlyArray<Row> = [
  { id: "citizenship", icon: GlobeIcon, name: "landing.demo.citizenship", sub: "Migraciones · № 24-018841" },
  { id: "dni", icon: IdCardIcon, name: "landing.demo.dni", sub: "RENAPER · № 31-440219" },
  { id: "parcel", icon: MailIcon, name: "landing.demo.parcel", sub: "Correo Argentino · CU 884120" },
];

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const media = window.matchMedia(REDUCED_MOTION);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** A made-up tracking board (no real data): the middle row changes status and the bot pops a notice. */
export function HeroDemo() {
  const t = useT();
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  const [step, setStep] = useState(0);
  const [toast, setToast] = useState(false);
  const [flash, setFlash] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // visitors who ask for less motion get the final state, still
  const stage = reduced ? DNI_STAGES.length - 1 : step;

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => {
      setStep((current) => (current + 1) % DNI_STAGES.length);
      setFlash((n) => n + 1);
      setToast(true);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(false), TOAST_MS);
    }, STAGE_MS);
    return () => {
      clearInterval(timer);
      clearTimeout(toastTimer.current);
    };
  }, [reduced]);

  const current = DNI_STAGES[stage]!;
  const chips: Record<string, { label: MessageKey; tone: StatusTone }> = {
    citizenship: { label: "landing.demo.review", tone: "pending" },
    dni: { label: current.key, tone: current.tone },
    parcel: { label: "landing.demo.transit", tone: "tracking" },
  };

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-[470px] flex-col items-center gap-4 lg:mt-14">
      <div className="w-full overflow-hidden rounded-card border border-line bg-surface shadow-[0_24px_60px_-30px_rgb(0_0_0/0.35)]">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
          <Logo variant="icon" height={22} alt="" />
          <h2 className="flex-1 text-[15px] font-bold text-fg">{t("landing.demo.title")}</h2>
          <span className="flex items-center gap-2 text-xs text-fg-muted">
            <span aria-hidden="true" className="live-dot relative size-2 rounded-full bg-success text-success" />
            {t("landing.demo.live")}
          </span>
        </div>
        <ul>
          {ROWS.map((row) => {
            const chip = chips[row.id]!;
            const tone = TONE_STYLES[chip.tone];
            return (
              <li
                key={row.id === "dni" ? `${row.id}-${flash}` : row.id}
                className={cn(
                  "relative flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-b-0",
                  row.id === "dni" && flash > 0 && "row-flash",
                )}
              >
                <span className={cn("absolute inset-y-2.5 left-0 w-[3px] rounded-full", tone.dot)} aria-hidden="true" />
                <span className="grid size-10 shrink-0 place-items-center rounded-field bg-line/40 text-fg">
                  <row.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[14.5px] font-semibold text-fg">{t(row.name)}</b>
                  <span className="block truncate text-xs text-fg-muted">{row.sub}</span>
                </span>
                <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11.5px] font-semibold", tone.badge)}>
                  <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone.dot)} />
                  {t(chip.label)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex max-w-[300px] items-center gap-3 rounded-field border border-line bg-bg px-4 py-3 text-[13px] leading-snug text-fg shadow-[0_18px_40px_-20px_rgb(0_0_0/0.45)] transition duration-500",
          toast ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[.97] opacity-0",
        )}
      >
        <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-brand text-brand-fg">
          <SendIcon className="size-4" />
        </span>
        <span>
          {t("landing.demo.toast", { stage: t(current.key) })}
          <small className="block text-[11.5px] text-fg-muted">{t("landing.demo.bot")}</small>
        </span>
      </div>
    </div>
  );
}
