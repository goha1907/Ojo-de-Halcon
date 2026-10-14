import type { TrackerDto } from "@ojo/core";
import { Alert, CollapsibleCard } from "@ojo/ui";
import type { MessageKey, TranslateFn } from "@ojo/shared";
import { PendingCaseActions } from "./tracker-actions";

interface Props {
  tracker: TrackerDto;
  t: TranslateFn;
  locale: string;
  /** Account owner's name, shown for cases that are not a relative's. */
  ownerName: string;
}

/** Case card: header fields on top, then every stage (newest first). */
export function TrackerCard({ tracker, t, locale, ownerName }: Props) {
  const fields = Object.entries(tracker.header).filter(([, value]) => value);
  const steps = [...tracker.steps].reverse();
  const checked = tracker.lastCheckedAt
    ? t("track.lastChecked", {
        date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(tracker.lastCheckedAt),
        ),
      })
    : t("track.notChecked");

  const who = tracker.person?.name ?? ownerName;
  const badge = (
    <span
      className={
        tracker.person
          ? "rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700"
          : "rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700"
      }
    >
      👤 {who}
    </span>
  );

  return (
    <CollapsibleCard
      title={tracker.label ?? tracker.header.expediente ?? tracker.reference.replaceAll(":", " / ")}
      badge={badge}
      description={[t(`track.status.${tracker.status}` as MessageKey), checked].join(" · ")}
    >
      <div className="space-y-4">
        {tracker.lastError === "not_found" ? (
          <Alert tone="info">{t("track.notFoundYet")}</Alert>
        ) : (
          tracker.lastError && <Alert tone="error">{t("track.lastError")}</Alert>
        )}
        {tracker.status === "PENDING_CONFIRMATION" && <Alert tone="info">{t("pjn.pending.text")}</Alert>}

        {fields.length > 0 && (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {fields.map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  {t(`track.header.${key}` as MessageKey)}
                </dt>
                <dd className="text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {tracker.status !== "PENDING_CONFIRMATION" && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">{t("track.steps")}</h3>
            {steps.length === 0 ? (
              <p className="text-sm text-slate-500">{t("track.noSteps")}</p>
            ) : (
              <ol className="space-y-2 border-l border-slate-200 pl-4">
                {steps.map((step, index) => (
                  <li key={`${step.date}-${index}`} className="text-sm">
                    <span className="text-xs text-slate-500">{step.date}</span>
                    <p className="font-medium text-slate-900">{step.title}</p>
                    {step.detail && <p className="text-slate-600">{step.detail}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {tracker.status === "PENDING_CONFIRMATION" ? (
          <PendingCaseActions id={tracker.id} />
        ) : (
          <p className="text-xs text-slate-500">{t("track.supportNote")}</p>
        )}
      </div>
    </CollapsibleCard>
  );
}
