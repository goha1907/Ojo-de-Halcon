import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import { ProfileCard } from "@/components/settings/profile-card";
import { ServicesCard } from "@/components/settings/services-card";
import { TelegramCard } from "@/components/settings/telegram-card";
import { getCore } from "@/server/core";
import { getT } from "@/server/i18n";
import { requireUser } from "@/server/session";

export default async function SettingsPage() {
  const user = await requireUser();
  const { t } = await getT();
  const services = await getCore().preferences.get(user.id);

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">{t("settings.title")}</h1>
      <ProfileCard
        email={user.email}
        initial={{ firstName: user.firstName, lastName: user.lastName, birthDate: user.birthDate }}
      />
      <TelegramCard linked={user.telegramLinked} username={user.telegramUsername} />
      <ServicesCard initial={services} />
      <DeleteAccountCard />
    </>
  );
}
