import {
  createTranslator,
  resolveLocale,
  type MessageKey,
  type TrackerHeaderFields,
  type TrackerKindValue,
  type TrackerStep,
} from "@ojo/shared";

export interface DigestInput {
  kind: TrackerKindValue;
  section: string;
  personName: string | null;
  header: TrackerHeaderFields;
  step: TrackerStep | null;
}

const STATUS_FIELD: Record<TrackerKindValue, string> = {
  RENAPER: "status",
  CORREO: "status",
  PJN: "sit_actual",
};

/** Message with the latest known stage of one case (sent right after linking Telegram). */
export function formatDigest(input: DigestInput, locale: string): string {
  const t = createTranslator(resolveLocale(locale));
  const section = t(`menu.${input.section}` as MessageKey);
  const service = input.personName ? `${section} · ${input.personName}` : section;
  const lines = [t("bot.digest.title", { service })];
  if (input.step) {
    const text = [input.step.title, input.step.detail].filter(Boolean).join(" — ");
    lines.push(`• ${[input.step.date, text].filter(Boolean).join(" · ")}`);
  } else {
    lines.push(t("bot.digest.noSteps"));
  }
  const status = input.header[STATUS_FIELD[input.kind]];
  if (status) lines.push(t("bot.update.status", { status }));
  return lines.join("\n");
}
