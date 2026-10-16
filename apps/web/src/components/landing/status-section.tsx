import type { MessageKey, TranslateFn } from "@ojo/shared";
import { cn } from "@ojo/ui";
import { TONE_STYLES, type StatusTone } from "@/lib/status-tones";

const LEGEND: ReadonlyArray<{ tone: StatusTone; label: MessageKey }> = [
  { tone: "tracking", label: "board.legend.tracking" },
  { tone: "removing", label: "board.legend.removing" },
  { tone: "finished", label: "board.legend.finished" },
  { tone: "paused", label: "board.legend.paused" },
  { tone: "pending", label: "board.legend.pending" },
];

const EVENTS: ReadonlyArray<{ title: MessageKey; when: MessageKey; fresh?: boolean }> = [
  { title: "landing.demo.ready", when: "landing.status.today", fresh: true },
  { title: "landing.demo.printing", when: "landing.status.ago3" },
  { title: "landing.demo.received", when: "landing.status.ago9" },
];

/** What the colour of a tracking means, next to the history of one of them. */
export function StatusSection({ t }: { t: TranslateFn }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div className="reveal space-y-5">
          <h2 className="max-w-[16ch] text-3xl font-bold tracking-tight text-fg sm:text-4xl">{t("landing.status.title")}</h2>
          <p className="max-w-[48ch] text-fg-muted">{t("landing.status.text")}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {LEGEND.map(({ tone, label }) => (
              <span
                key={tone}
                className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", TONE_STYLES[tone].badge)}
              >
                <span aria-hidden="true" className={cn("size-1.5 rounded-full", TONE_STYLES[tone].dot)} />
                {t(label)}
              </span>
            ))}
          </div>
        </div>
        <ol className="reveal rounded-card border border-line bg-surface p-6 shadow-sm">
          {EVENTS.map((event, index) => (
            <li
              key={event.title}
              className={cn(
                "relative grid grid-cols-[18px_1fr_auto] gap-4 pb-5 last:pb-0",
                index < EVENTS.length - 1 &&
                  "before:absolute before:bottom-[-2px] before:left-2 before:top-[18px] before:w-0.5 before:bg-line",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-10 mt-0.5 size-[18px] rounded-full border-2",
                  event.fresh ? "timeline-new border-success bg-success shadow-[0_0_0_5px_color-mix(in_srgb,var(--success)_22%,transparent)]" : "border-line bg-bg",
                )}
              />
              <div>
                <b className="block text-[14.5px] font-semibold text-fg">{t(event.title)}</b>
                <span className="text-xs text-fg-muted">RENAPER · DNI № 31-440219</span>
              </div>
              <time className="font-mono text-xs leading-6 text-fg-muted">{t(event.when)}</time>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
