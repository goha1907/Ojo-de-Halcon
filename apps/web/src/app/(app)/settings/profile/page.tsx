import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import { PeopleCard } from "@/components/settings/people-card";
import { ProfileCard } from "@/components/settings/profile-card";
import { TelegramCard } from "@/components/settings/telegram-card";
import { WhatsappCard } from "@/components/settings/whatsapp-card";
import { getCore } from "@/server/core";
import { getEnv } from "@/server/env";
import { getT } from "@/server/i18n";
import { requireUser } from "@/server/session";

export default async function SettingsProfilePage() {
  const user = await requireUser();
  const { t } = await getT();
  const core = getCore();
  const [people, access] = await Promise.all([core.people.list(user.id), core.access.get(user.id)]);

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">{t("nav.settings.profile")}</h1>
      <ProfileCard
        email={user.email}
        emailVerified={user.emailVerified}
        initial={{ firstName: user.firstName, lastName: user.lastName, birthDate: user.birthDate, pjnJurisdiction: user.pjnJurisdiction }}
      />
      {getEnv().FEATURE_RELATIVES && <PeopleCard people={people} subscribed={access.plan === "subscription"} />}
      <TelegramCard linked={user.telegramLinked} username={user.telegramUsername} />
      <WhatsappCard />
      <DeleteAccountCard />
    </>
  );
}
