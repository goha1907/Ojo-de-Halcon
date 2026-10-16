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
  /** Identifies the case: trámite number or court file number. */
  caseId: string;
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
export const STATUS_FIELD: Record<TrackerKindValue, string> = {
  DNM_DNI: "status",
  DNM_CITIZENSHIP: "status",
  RENAPER: "status",
  CORREO: "status",
  OCASA: "status",
  PJN: "sit_actual",
};

/** First line of every message: which case it is, by its number. */
export function caseLine(t: ReturnType<typeof createTranslator>, kind: TrackerKindValue, caseId: string): string {
  return t(kind === "PJN" ? "bot.case.court" : "bot.case.tramite", { id: caseId });
}

/**
 * Simplified Telegram text, always in the same order: which case, which
 * service, then what happened and the current status.
 */
export function formatNotification(input: NotificationInput): string {
  const t = createTranslator(resolveLocale(input.locale));
  const service = t(`menu.${TRACKER_KIND_SECTION[input.kind]}` as MessageKey);

  const lines = [
    caseLine(t, input.kind, input.caseId),
    t(input.payload.initial ? "bot.initial.title" : "bot.update.title", { service }),
  ];
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
