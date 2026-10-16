import { TONE_STYLES } from "@/lib/status-tones";

/** Colour of a summary tile: the colours of the card edges, plus blue for paid places. */
const TILE_TONES = {
  tracking: { edge: TONE_STYLES.tracking.edge, number: "text-success-fg" },
  removing: { edge: TONE_STYLES.removing.edge, number: "text-warning-fg" },
  finished: { edge: TONE_STYLES.finished.edge, number: "text-error-fg" },
  slots: {
    edge: "border-l-info shadow-[-8px_0_16px_-10px_color-mix(in_srgb,var(--info)_70%,transparent)]",
    number: "text-info-fg",
  },
  plain: { edge: "border-l-line", number: "text-fg" },
} as const;

export type StatTone = keyof typeof TILE_TONES;

/** A number with a label and a coloured left edge. */
export function StatTile({
  label,
  value,
  hint,
  tone = "plain",
}: {
  label: string;
  value: string | number;
  hint?: string | undefined;
  tone?: StatTone;
}) {
  const style = TILE_TONES[tone];
  return (
    <div className={`rounded-card border border-l-4 border-line bg-surface p-4 shadow-sm ${style.edge}`}>
      <div className="text-xs text-fg-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${style.number}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-fg-muted">{hint}</div>}
    </div>
  );
}
