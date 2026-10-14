import { parsePjnReference } from "@ojo/shared";
import { ClosedCases, NotificationsCard } from "@/components/settings/notifications-card";
import { getCore } from "@/server/core";
import { getT } from "@/server/i18n";
import { requireUser } from "@/server/session";

export default async function SettingsNotificationsPage() {
  const user = await requireUser();
  const { t } = await getT();
  const trackers = await getCore().trackers.list(user.id);
  const shown = trackers.filter((item) => item.status !== "PENDING_CONFIRMATION");
  // finished and paused cases are not polled and not notified: they are listed apart
  const open = shown.filter((item) => item.status === "ACTIVE");
  const closed = shown.filter((item) => item.status === "FINISHED" || item.status === "PAUSED");
  const displayNumber = (item: (typeof trackers)[number]) =>
    item.kind === "PJN"
      ? (item.header.expediente ??
        (() => {
          const parsed = parsePjnReference(item.reference);
          return parsed ? `${parsed.number}/${parsed.year}` : item.reference;
        })())
      : item.reference;

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">{t("nav.settings.notifications")}</h1>
      <NotificationsCard
        telegramLinked={user.telegramLinked}
        cases={open.map((item) => ({
          id: item.id,
          kind: item.kind,
          reference: displayNumber(item),
          label: item.label,
          telegram: item.notifyTelegram,
          whatsapp: item.notifyWhatsapp,
        }))}
      />
      <ClosedCases
        closed={closed.map((item) => ({
          id: item.id,
          kind: item.kind,
          reference: displayNumber(item),
          label: item.label,
          status: item.status === "FINISHED" ? ("FINISHED" as const) : ("PAUSED" as const),
        }))}
      />
    </>
  );
}
