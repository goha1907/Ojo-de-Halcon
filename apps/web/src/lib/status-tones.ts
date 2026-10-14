/** The colour language of a tracking: card edge, legend dot and badge, in one place. */
export type StatusTone = "tracking" | "removing" | "finished" | "paused" | "pending";

export const TONE_STYLES: Record<StatusTone, { edge: string; dot: string; badge: string }> = {
  tracking: {
    edge: "border-l-emerald-500 shadow-[-8px_0_16px_-10px_rgba(16,185,129,0.7)]",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700",
  },
  removing: {
    edge: "border-l-amber-400 shadow-[-8px_0_16px_-10px_rgba(245,158,11,0.7)]",
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700",
  },
  finished: {
    edge: "border-l-red-500 shadow-[-8px_0_16px_-10px_rgba(239,68,68,0.7)]",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700",
  },
  paused: {
    edge: "border-l-slate-400 shadow-[-8px_0_16px_-10px_rgba(100,116,139,0.6)]",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600",
  },
  pending: {
    edge: "border-l-sky-400 shadow-[-8px_0_16px_-10px_rgba(56,189,248,0.7)]",
    dot: "bg-sky-400",
    badge: "bg-sky-50 text-sky-700",
  },
};

export function toneOf(status: string, kept: boolean): StatusTone {
  if (status === "FINISHED") return "finished";
  if (status === "PAUSED") return "paused";
  if (status === "PENDING_CONFIRMATION") return "pending";
  return kept ? "tracking" : "removing";
}
