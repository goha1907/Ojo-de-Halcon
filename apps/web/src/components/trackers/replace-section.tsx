import type { TrackerDto } from "@ojo/core";
import type { TranslateFn } from "@ojo/shared";
import { FixNumberForm } from "./fix-number-form";
import { ReleaseCaseButton } from "./release-case-button";

/** What can be done with a confirmed case: replace it (rule: once per 30 days) or wait. */
export function ReplaceSection({
  tracker,
  t,
  locale,
}: {
  tracker: TrackerDto;
  t: TranslateFn;
  locale: string;
}) {
  // a closed or paused case is not replaced: the user adds a new one instead (its place is free)
  if (tracker.status === "PAUSED" || tracker.status === "FINISHED") return null;
  // before the first data the card itself offers fixing the number or deleting
  if (tracker.notStarted) return null;
  if (tracker.kind !== "PJN") {
    if (tracker.canReplace) {
      return (
        <details className="w-full rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-sm font-medium text-fg">
            {t("track.replace.title")}
          </summary>
          <div className="mt-3">
            <FixNumberForm id={tracker.id} current={tracker.reference} kind={tracker.kind} mode="replace" />
          </div>
        </details>
      );
    }
  } else if (tracker.canReplace) {
    return (
      <div className="w-full">
        <ReleaseCaseButton id={tracker.id} />
      </div>
    );
  }
  if (!tracker.replaceAvailableAt) return null;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(tracker.replaceAvailableAt));
  return <p className="ml-auto text-xs text-fg-muted">{t("track.replace.later", { date })}</p>;
}
