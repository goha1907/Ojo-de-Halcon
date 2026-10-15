import { ChangePasswordCard } from "@/components/settings/change-password-card";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import { ProfileCard } from "@/components/settings/profile-card";
import { TelegramCard } from "@/components/settings/telegram-card";
import { WhatsappCard } from "@/components/settings/whatsapp-card";
import { getT } from "@/server/i18n";
import { requireUser } from "@/server/session";

export default async function SettingsProfilePage() {
  const user = await requireUser();
  const { t } = await getT();

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">{t("nav.settings.profile")}</h1>
      <ProfileCard
        email={user.email}
        emailVerified={user.emailVerified}
        initial={{ firstName: user.firstName, lastName: user.lastName, birthDate: user.birthDate, pjnJurisdiction: user.pjnJurisdiction }}
      />
      <TelegramCard linked={user.telegramLinked} username={user.telegramUsername} />
      <WhatsappCard />
      <ChangePasswordCard />
      <DeleteAccountCard />
    </>
  );
}
