import { ROUTES, SERVICE_OFFICIAL_LINK, findLink, findService, type MessageKey } from "@ojo/shared";
import { Alert, Card } from "@ojo/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCore } from "@/server/core";
import { getT } from "@/server/i18n";
import { requireUser } from "@/server/session";

export default async function ServicePage({
  params,
}: {
  params: Promise<{ group: string; slug: string }>;
}) {
  const { group, slug } = await params;
  const service = findService(group, slug);
  if (!service) notFound();

  const user = await requireUser();
  const { t } = await getT();
  const preferences = await getCore().preferences.get(user.id);
  const official = findLink(SERVICE_OFFICIAL_LINK[service.section]);
  const enabled = preferences[service.section];

  return (
    <>
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t(`menu.group.${service.group}` as MessageKey)}
        </p>
        <h1 className="text-xl font-semibold text-slate-900">{t(`sections.${service.section}` as MessageKey)}</h1>
      </header>

      <Card title={t("service.soon")} description={t("service.soonText")}>
        <div className="space-y-4">
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
          <Alert tone="info">
            {t("service.notifications")}:{" "}
            <strong>{enabled ? t("service.notificationsOn") : t("service.notificationsOff")}</strong>.{" "}
            <Link href={ROUTES.settings} className="underline">
              {t("service.changeInSettings")}
            </Link>
          </Alert>
        </div>
      </Card>
    </>
  );
}
