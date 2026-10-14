import {
  createTranslator,
  resolveLocale,
  type MessageKey,
  type TrackerHeaderFields,
  type TrackerKindValue,
  type TrackerStep,
} from "@ojo/shared";
import { STATUS_FIELD, caseLine } from "./format-notification";

export interface DigestInput {
  kind: TrackerKindValue;
  section: string;
  caseId: string;
  header: TrackerHeaderFields;
  step: TrackerStep | null;
}

/** Latest known stage of one case (sent right after linking Telegram): whose, which service, stage, status. */
export function formatDigest(input: DigestInput, locale: string): string {
  const t = createTranslator(resolveLocale(locale));
  const service = t(`menu.${input.section}` as MessageKey);
  const lines = [
    caseLine(t, input.kind, input.caseId),
    t("bot.digest.title", { service }),
  ];
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
