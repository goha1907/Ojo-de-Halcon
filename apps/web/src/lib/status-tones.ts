/** The colour language of a tracking: card edge, legend dot and badge, in one place. */
export type StatusTone = "tracking" | "removing" | "finished" | "paused" | "pending";

export const TONE_STYLES: Record<StatusTone, { edge: string; dot: string; badge: string }> = {
  tracking: {
    edge: "border-l-success shadow-[-8px_0_16px_-10px_color-mix(in_srgb,var(--success)_70%,transparent)]",
    dot: "bg-success",
    badge: "bg-success-bg text-success-fg",
  },
  removing: {
    edge: "border-l-warning shadow-[-8px_0_16px_-10px_color-mix(in_srgb,var(--warning)_70%,transparent)]",
    dot: "bg-warning",
    badge: "bg-warning-bg text-warning-fg",
  },
  finished: {
    edge: "border-l-error shadow-[-8px_0_16px_-10px_color-mix(in_srgb,var(--error)_70%,transparent)]",
    dot: "bg-error",
    badge: "bg-error-bg text-error-fg",
  },
  paused: {
    edge: "border-l-fg-subtle shadow-[-8px_0_16px_-10px_color-mix(in_srgb,var(--fg-subtle)_60%,transparent)]",
    dot: "bg-fg-subtle",
    badge: "bg-line/40 text-fg",
  },
  pending: {
    edge: "border-l-info shadow-[-8px_0_16px_-10px_color-mix(in_srgb,var(--info)_70%,transparent)]",
    dot: "bg-info",
    badge: "bg-info-bg text-info-fg",
  },
};

export function toneOf(status: string, kept: boolean): StatusTone {
  if (status === "FINISHED") return "finished";
  if (status === "PAUSED") return "paused";
  if (status === "PENDING_CONFIRMATION") return "pending";
  return kept ? "tracking" : "removing";
}
