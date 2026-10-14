import {
  TRACKER_KIND_SECTION,
  createTranslator,
  resolveLocale,
  type MessageKey,
  type TrackerKindValue,
} from "@ojo/shared";

export interface NotificationInput {
  kind: TrackerKindValue;
  locale: string;
  label: string | null;
  payload: {
    /** One stage per event (current format). */
    step?: { date: string; title: string; detail: string } | null;
    /** Events written before one-event-per-stage; still delivered. */
    newSteps?: { date: string; title: string; detail: string }[];
    header: Record<string, string>;
    /** First report of a case that was just added. */
    initial?: boolean;
  };
}

/** Header field that best describes the current state of each kind. */
const STATUS_FIELD: Record<TrackerKindValue, string> = {
  RENAPER: "status",
  CORREO: "status",
  PJN: "sit_actual",
};

/** Simplified Telegram text: what changed, no scraping details. */
export function formatNotification(input: NotificationInput): string {
  const t = createTranslator(resolveLocale(input.locale));
  const sectionKey = `menu.${TRACKER_KIND_SECTION[input.kind]}` as MessageKey;
  const service = input.label ? `${t(sectionKey)} · ${input.label}` : t(sectionKey);

  const lines = [t(input.payload.initial ? "bot.initial.title" : "bot.update.title", { service })];
  const steps = input.payload.step ? [input.payload.step] : (input.payload.newSteps ?? []);
  for (const step of steps) {
    const text = [step.title, step.detail].filter(Boolean).join(" — ");
    lines.push(`• ${[step.date, text].filter(Boolean).join(" · ")}`);
  }
  const status = input.payload.header[STATUS_FIELD[input.kind]];
  if (status) lines.push(t("bot.update.status", { status }));
  if (!input.payload.initial) lines.push(t("bot.update.openSite"));
  return lines.join("\n");
}
