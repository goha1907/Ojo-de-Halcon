import { TONE_STYLES } from "@/lib/status-tones";

/** Colour of a summary tile: the colours of the card edges, plus blue for paid places. */
const TILE_TONES = {
  tracking: { edge: TONE_STYLES.tracking.edge, number: "text-emerald-600" },
  removing: { edge: TONE_STYLES.removing.edge, number: "text-amber-500" },
  finished: { edge: TONE_STYLES.finished.edge, number: "text-red-600" },
  slots: {
    edge: "border-l-blue-500 shadow-[-8px_0_16px_-10px_rgba(59,130,246,0.7)]",
    number: "text-blue-600",
  },
  plain: { edge: "border-l-slate-200", number: "text-slate-900" },
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
    <div className={`rounded-2xl border border-l-4 border-slate-200 bg-white p-4 shadow-sm ${style.edge}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${style.number}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
