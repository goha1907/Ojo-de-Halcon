import { parsePjnReference } from "@ojo/shared";
import { NotificationsCard } from "@/components/settings/notifications-card";
import { getCore } from "@/server/core";
import { getT } from "@/server/i18n";
import { requireUser } from "@/server/session";

export default async function SettingsNotificationsPage() {
  const user = await requireUser();
  const { t } = await getT();
  const trackers = await getCore().trackers.list(user.id);

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">{t("nav.settings.notifications")}</h1>
      <NotificationsCard
        telegramLinked={user.telegramLinked}
        cases={trackers
          .filter((item) => item.status !== "PENDING_CONFIRMATION")
          .map((item) => ({
            id: item.id,
            kind: item.kind,
            reference:
              item.kind === "PJN"
                ? (item.header.expediente ??
                  (() => {
                    const parsed = parsePjnReference(item.reference);
                    return parsed ? `${parsed.number}/${parsed.year}` : item.reference;
                  })())
                : item.reference,
            label: item.label,
            person: item.person?.name ?? null,
            telegram: item.notifyTelegram,
            whatsapp: item.notifyWhatsapp,
          }))}
      />
    </>
  );
}
