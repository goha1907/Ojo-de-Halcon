import type { TrackerDto } from "@ojo/core";
import { isDnmKind, parsePjnReference, type TranslateFn } from "@ojo/shared";
import { Alert, cn } from "@ojo/ui";
import { daysSince } from "@/lib/days";
import { displayNumber } from "@/lib/tracker-view";
import { toneOf } from "@/lib/status-tones";
import { DniCardShell } from "./dni-card-shell";
import { FixNumberForm } from "./fix-number-form";
import { ReleaseCaseButton } from "./release-case-button";
import { PendingCaseActions } from "./tracker-actions";
import { ReplaceSection } from "./replace-section";
import { SubscriptionControl } from "./subscription-control";

interface Props {
  tracker: TrackerDto;
  t: TranslateFn;
  locale: string;
  subscription: { active: boolean; periodEnd: string | null };
}

function Tile({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-field border border-line px-3.5 py-2.5", wide && "sm:col-span-2")}>
      <div className="text-xs text-fg-muted">{label}</div>
      <div className="font-semibold text-fg">{children}</div>
    </div>
  );
}

/** RENAPER / Correo card: current state on the left, every known stage on the right. */
export function DniCard({ tracker, t, locale, subscription }: Props) {
  const now = new Date();
  const isRenaper = tracker.kind === "RENAPER";
  const isCourt = tracker.kind === "PJN";
  const isDnm = isDnmKind(tracker.kind);
  const h = tracker.header;
  const court = isCourt ? parsePjnReference(tracker.reference) : null;
  // the number shown next to the name: the court file number, or the trámite number
  const caseNumber = isCourt ? (h.expediente ?? (court ? `${court.number}/${court.year}` : tracker.reference)) : displayNumber(tracker);
  // stages are stored oldest first; the card shows the newest on top
  const stages = [...tracker.steps].reverse();
  const latest = stages[0];
  const days = (text: string | undefined) => {
    const count = daysSince(text, now);
    return count === null ? "" : ` · ${t("track.dni.days", { count })}`;
  };

  const status = isRenaper || isDnm ? h.status : isCourt ? h.sit_actual : latest?.title;
  const statusDate = isRenaper || isDnm ? h.statusDate : latest?.date;
  const stageText = isRenaper ? h.stageText : isCourt || isDnm ? undefined : latest?.detail;
  const added = t("track.card.added", {
    date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(tracker.addedAt)),
  });
  // a number nothing was ever read for: it can be corrected or the tracking deleted
  const unread = tracker.notStarted && !isCourt;
  const deletable = tracker.notStarted && tracker.status !== "PENDING_CONFIRMATION";
  const type = [h.type, h.class].filter(Boolean).join(" · ");

  const alert =
    tracker.lastError === "not_found" ? (
      <Alert tone="info">{t("track.notFoundYet")}</Alert>
    ) : tracker.lastError === "mismatch" ? (
      <Alert tone="error">{t("track.mismatch")}</Alert>
    ) : tracker.lastError === "birth_date_missing" ? (
      <Alert tone="error">{t("track.error.birthRequired")}</Alert>
    ) : tracker.lastError ? (
      <Alert tone="error">{t("track.lastError")}</Alert>
    ) : null;

  return (
    <DniCardShell
      id={tracker.id}
      tone={toneOf(tracker.status, tracker.keptInSubscription)}
      label={tracker.label}
      number={caseNumber}
      summary={
        status ? (
          <>
            <b className="text-fg">{status}</b>
            {isRenaper ? days(statusDate) : ""}
          </>
        ) : null
      }
      renameTitle={t("track.dni.rename")}
      toggleTitle={t("track.dni.toggle")}
      strip={
        <div className="space-y-2">
          {deletable ? (
            <div>
              <ReleaseCaseButton id={tracker.id} mode="delete" />
            </div>
          ) : (
            <SubscriptionControl
              trackerId={tracker.id}
              status={tracker.status}
              kept={tracker.keptInSubscription}
              subscribed={subscription.active}
              periodEnd={subscription.periodEnd}
            />
          )}
          <div className="flex flex-wrap items-start gap-x-3 gap-y-3 text-xs text-fg-muted">
            <span>{added}</span>
            {deletable && !isCourt && <p className="ml-auto">{t("track.notStarted.hint")}</p>}
            <ReplaceSection tracker={tracker} t={t} locale={locale} />
          </div>
        </div>
      }
    >
      {alert && <div className="border-b border-line px-5 py-3">{alert}</div>}
      {tracker.status === "PENDING_CONFIRMATION" && (
        <div className="space-y-3 border-b border-line px-5 py-3">
          <Alert tone="info">{t("pjn.pending.text")}</Alert>
          <PendingCaseActions id={tracker.id} />
        </div>
      )}
      {unread ? (
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-fg-muted">{t("track.notStarted.text")}</p>
          <div className="max-w-xl">
            <FixNumberForm
              id={tracker.id}
              current={tracker.reference}
              kind={tracker.kind}
              mode="typo"
              bare
              {...(isDnm ? { birthDate: tracker.holderBirthDate ?? "" } : {})}
            />
          </div>
        </div>
      ) : (
      <div className="grid md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3 px-5 py-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
            {t(isRenaper ? "track.dni.titleRenaper" : isCourt ? "track.court.title" : isDnm ? "track.dnm.title" : "track.dni.titleCorreo")}
          </h4>
          {status ? (
            <>
              <div>
                <div className="text-2xl font-extrabold leading-tight text-fg">{status}</div>
                {statusDate && (
                  <div className="mt-1 text-sm text-fg-muted">
                    {t("track.dni.since", { date: statusDate })}
                    {isRenaper ? days(statusDate) : ""}
                  </div>
                )}
              </div>
              {(h.stage || stageText) && (
                <div className="rounded-field border border-line px-3.5 py-2.5 text-sm text-fg">
                  {isRenaper && h.stage && <b>{h.stage}. </b>}
                  {stageText}
                </div>
              )}
              {isCourt && (
                <div className="grid gap-3">
                  {h.expediente && <Tile label={t("track.header.expediente")}>{h.expediente}</Tile>}
                  {h.dependencia && <Tile label={t("track.header.dependencia")}>{h.dependencia}</Tile>}
                  {h.caratula && (
                    <Tile label={t("track.header.caratula")}>
                      <span className="font-medium">{h.caratula}</span>
                    </Tile>
                  )}
                </div>
              )}
              {isDnm && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {h.state && <Tile label={t("track.dnm.state")}>{h.state}</Tile>}
                  {h.nationality && <Tile label={t("track.dnm.nationality")}>{h.nationality}</Tile>}
                  {h.office && <Tile label={t("track.dnm.office")}>{h.office}</Tile>}
                  {h.disposition && <Tile label={t("track.dnm.disposition")}>{h.disposition}</Tile>}
                  {h.next && (
                    <Tile label={t("track.dnm.next")} wide>
                      <span className="font-medium">{h.next}</span>
                    </Tile>
                  )}
                </div>
              )}
              {isRenaper && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {h.takenDate && (
                    <Tile label={t("track.dni.taken")}>
                      {h.takenDate.slice(0, 10)}
                      {days(h.takenDate)}
                    </Tile>
                  )}
                  {h.previous && (
                    <Tile label={t("track.dni.previous")}>
                      {h.previous}
                      {h.previousDate && <div className="font-normal text-fg-muted">{h.previousDate}</div>}
                    </Tile>
                  )}
                  {type && <Tile label={t("track.dni.type")}>{type}</Tile>}
                  {h.pickup && <Tile label={t("track.dni.pickup")}>{h.pickup}</Tile>}
                  {h.description && (
                    <Tile label={t("track.dni.description")} wide>
                      <span className="font-medium">{h.description}</span>
                    </Tile>
                  )}
                  {h.office && (
                    <Tile label={t("track.dni.office")} wide>
                      <span className="font-medium">{h.office}</span>{" "}
                      {h.officeAddress && <span className="font-normal text-fg-muted">{h.officeAddress}</span>}
                    </Tile>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-fg-muted">{t("track.dni.noStages")}</p>
          )}
        </div>

        <div className="border-t border-line px-5 py-4 md:border-l md:border-t-0">
          {stages.length === 0 ? (
            <p className="text-sm text-fg-muted">{t("track.dni.noStages")}</p>
          ) : (
            <ul className="mb-3.5 space-y-0">
              {stages.map((step, index) => (
                <li
                  key={`${step.date}-${index}`}
                  className="relative border-l-2 border-line py-1.5 pl-4 text-sm"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute -left-[5px] top-3 h-2 w-2 rounded-full",
                      index === 0 ? "bg-success ring-4 ring-success-bg" : "bg-brand",
                    )}
                  />
                  <b className="text-fg">{step.title}</b>
                  {step.detail && !step.title.includes(step.detail) && (
                    <span className="text-fg-muted"> · {step.detail}</span>
                  )}
                  <span className="text-fg-muted">
                    {" "}
                    · {t("track.dni.since", { date: step.date })}
                    {index === 0 ? ` · ${t("track.dni.current")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {isRenaper && <p className="text-xs text-fg-muted">{t("track.dni.renaperNote")}</p>}
        </div>
      </div>
      )}
    </DniCardShell>
  );
}
