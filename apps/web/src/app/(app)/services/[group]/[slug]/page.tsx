import {
  settingsHref,
  SERVICE_OFFICIAL_LINK,
  TRACKER_KIND_SECTION,
  findLink,
  findService,
  type MessageKey,
  type TrackerKindValue,
} from "@ojo/shared";
import { Alert, Card } from "@ojo/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddTrackerButton } from "@/components/trackers/add-tracker-button";
import { CourtFinder } from "@/components/trackers/court-finder";
import { DniCard } from "@/components/trackers/dni-card";
import { TrackerBoard } from "@/components/trackers/tracker-board";
import { currentStatus, displayNumber, lastChange } from "@/lib/tracker-view";
import { getCore } from "@/server/core";
import { getT } from "@/server/i18n";
import { requireUser } from "@/server/session";

/** Which tracker kind a section shows; sections without one are still "coming soon". */
const SECTION_KIND = Object.fromEntries(
  Object.entries(TRACKER_KIND_SECTION).map(([kind, section]) => [section, kind as TrackerKindValue]),
);

export default async function ServicePage({
  params,
}: {
  params: Promise<{ group: string; slug: string }>;
}) {
  const { group, slug } = await params;
  const service = findService(group, slug);
  if (!service) notFound();

  const user = await requireUser();
  const { t, locale } = await getT();
  const core = getCore();
  const official = findLink(SERVICE_OFFICIAL_LINK[service.section]);
  const kind = SECTION_KIND[service.section];
  const trackers = kind ? (await core.trackers.list(user.id)).filter((item) => item.kind === kind) : [];
  const billing = kind ? await core.billing.state(user.id) : null;
  const access = await core.access.get(user.id);
  const subscription = { active: access.plan === "subscription", periodEnd: access.until };
  // with no court case yet the user is offered to find theirs by the profile name
  const offerFinder = kind === "PJN" && trackers.length === 0;

  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t(`menu.group.${service.group}` as MessageKey)}
          </p>
          <h1 className="text-xl font-semibold text-slate-900">{t(`sections.${service.section}` as MessageKey)}</h1>
        </div>
        {/* opens the modal of this very section, without the kind dropdown */}
        {kind && (
          <div className="flex flex-col items-end gap-1">
            <AddTrackerButton kind={kind} />
            <span className="text-xs text-slate-500">{billing && billing.capacity > 0 ? t("track.usage", { used: billing.activeCases, limit: billing.capacity }) : null}</span>
          </div>
        )}
      </header>

      {kind ? (
        <>
          {offerFinder && <CourtFinder />}
          <TrackerBoard
            storageKey={`ojo.board.${service.group}.${service.slug}`}
            items={trackers.map((tracker) => ({
              id: tracker.id,
              node: <DniCard tracker={tracker} t={t} locale={locale} subscription={subscription} />,
              status: tracker.status,
              kept: tracker.keptInSubscription,
              name: tracker.label ?? displayNumber(tracker),
              number: displayNumber(tracker),
              addedAt: new Date(tracker.addedAt).getTime(),
              changedAt: lastChange(tracker),
              search: [
                tracker.label,
                displayNumber(tracker),
                tracker.reference,
                currentStatus(tracker),
                ...Object.values(tracker.header),
                ...tracker.steps.flatMap((step) => [step.title, step.detail, step.date]),
              ]
                .filter(Boolean)
                .join(" "),
            }))}
          />
          {trackers.length === 0 && kind !== "PJN" && (
            <Card title={t("track.empty")} description={t("track.emptyHint")}>
              {official && (
                <a
                  href={official.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-700 underline"
                >
                  {t("service.officialSite")}
                </a>
              )}
            </Card>
          )}
        </>
      ) : (
        <Card title={t("service.soon")} description={t("service.soonText")}>
          {official && (
            <a
              href={official.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              {t("service.officialSite")}
            </a>
          )}
        </Card>
      )}

      <Alert tone="info">
        {t("service.notificationsHint")}{" "}
        <Link href={settingsHref("notifications")} className="underline">
          {t("service.changeInSettings")}
        </Link>
      </Alert>
    </>
  );
}
