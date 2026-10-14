import {
  ROUTES,
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
import { CourtFinder } from "@/components/trackers/court-finder";
import { TrackerCard } from "@/components/trackers/tracker-card";
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
  const preferences = await core.preferences.get(user.id);
  const official = findLink(SERVICE_OFFICIAL_LINK[service.section]);
  const enabled = preferences[service.section];
  const kind = SECTION_KIND[service.section];
  const ownerName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || t("track.person.me");
  const trackers = kind ? (await core.trackers.list(user.id)).filter((item) => item.kind === kind) : [];
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
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t(`menu.group.${service.group}` as MessageKey)}
        </p>
        <h1 className="text-xl font-semibold text-slate-900">{t(`sections.${service.section}` as MessageKey)}</h1>
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
              <TrackerCard key={tracker.id} tracker={tracker} t={t} locale={locale} ownerName={ownerName} />
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
        {t("service.notifications")}:{" "}
        <strong>{enabled ? t("service.notificationsOn") : t("service.notificationsOff")}</strong>.{" "}
        <Link href={ROUTES.settings} className="underline">
          {t("service.changeInSettings")}
        </Link>
      </Alert>
    </>
  );
}
