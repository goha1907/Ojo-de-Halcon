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
  const people = kind === "PJN" ? await core.people.list(user.id) : [];
  // any tracker counts, finished ones too: the case is already known and is not offered again
  const hasCase = (personId: string | null) =>
    trackers.some((item) => (item.person?.id ?? null) === personId);
  // everyone who has a court chosen and no case yet gets a "find the case" offer
  const finders = [
    ...(hasCase(null) ? [] : [{ personId: undefined, name: undefined }]),
    ...people
      .filter((person) => person.pjnJurisdiction && !hasCase(person.id))
      .map((person) => ({ personId: person.id, name: `${person.firstName} ${person.lastName}` })),
  ];

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
            <span className="text-xs text-slate-500">{billing && access.plan === "subscription" ? t("track.usage", { used: billing.activeCases, limit: billing.paidCases }) : null}</span>
          </div>
        )}
      </header>

      {kind ? (
        <>
          {kind === "PJN" &&
            finders.map((finder) => (
              <CourtFinder
                key={finder.personId ?? "self"}
                {...(finder.personId ? { personId: finder.personId, personName: finder.name } : {})}
              />
            ))}
          {/* the owner's cases first, then relatives in the order they were added */}
          {[...trackers]
            .sort((a, b) => Number(a.person !== null) - Number(b.person !== null))
            .map((tracker) => (
              <DniCard key={tracker.id} tracker={tracker} t={t} locale={locale} subscription={subscription} />
            ))}
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
