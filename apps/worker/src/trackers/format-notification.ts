import {
  TRACKER_KIND_SECTION,
  sectionGroup,
  sectionHref,
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
  /** The name the user gave the case, if any. */
  label?: string | null;
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
 * First lines of every message, always the same: what it is (icon, group · service), the user's own name for the
 * case when there is one, and the number as it was entered.
 */
export function messageHead(
  t: ReturnType<typeof createTranslator>,
  icon: string,
  section: string,
  kind: TrackerKindValue,
  caseId: string,
  label?: string | null,
): string[] {
  const group = sectionGroup(section);
  const service = t(`menu.${section}` as MessageKey);
  const title = group ? `${t(`menu.group.${group}` as MessageKey)} · ${service}` : service;
  return [`${icon} ${title}`, ...(label?.trim() ? [`«${label.trim()}»`] : []), caseLine(t, kind, caseId)];
}

/** Telegram text in a fixed order: service, the user's name, number, then what happened (date, stage) and the status. */
export function formatNotification(input: NotificationInput): string {
  const t = createTranslator(resolveLocale(input.locale));
  const lines = messageHead(t, input.payload.initial ? "🆕" : "🔔", TRACKER_KIND_SECTION[input.kind], input.kind, input.caseId, input.label);
  if (input.payload.initial) lines.push(t("bot.initial.title"));
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

/** "Open in the cabinet" button that leads to the page of the case's service; none without a public site address. */
export function notificationButton(
  input: { kind: TrackerKindValue; locale: string },
  siteUrl: string | null | undefined,
): { text: string; url: string } | undefined {
  const path = sectionHref(TRACKER_KIND_SECTION[input.kind]);
  if (!siteUrl || !path) return undefined;
  const t = createTranslator(resolveLocale(input.locale));
  return { text: t("bot.welcomeButton"), url: new URL(path, siteUrl).toString() };
}
