import { AccessCard } from "@/components/settings/access-card";
import { PeopleCard } from "@/components/settings/people-card";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import { ProfileCard } from "@/components/settings/profile-card";
import { ServicesCard } from "@/components/settings/services-card";
import { TelegramCard } from "@/components/settings/telegram-card";
import { getCore } from "@/server/core";
import { getEnv } from "@/server/env";
import { getT } from "@/server/i18n";
import { requireUser } from "@/server/session";

export default async function SettingsPage() {
  const user = await requireUser();
  const { t } = await getT();
  const core = getCore();
  const [services, people, access] = await Promise.all([
    core.preferences.get(user.id),
    core.people.list(user.id),
    core.access.get(user.id),
  ]);

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">{t("settings.title")}</h1>
      <ProfileCard
        email={user.email}
        emailVerified={user.emailVerified}
        initial={{ firstName: user.firstName, lastName: user.lastName, birthDate: user.birthDate, pjnJurisdiction: user.pjnJurisdiction }}
      />
      <PeopleCard people={people} />
      <TelegramCard linked={user.telegramLinked} username={user.telegramUsername} />
      <ServicesCard initial={services} />
      <AccessCard access={access} stubEnabled={getEnv().PAYMENTS_STUB} />
      <DeleteAccountCard />
    </>
  );
}
