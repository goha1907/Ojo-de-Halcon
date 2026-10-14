import { ROUTES } from "@ojo/shared";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { getCore } from "@/server/core";
import { getT } from "@/server/i18n";
import { requireUser } from "@/server/session";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboardingDone) redirect(ROUTES.dashboard);
  const { t } = await getT();
  const services = await getCore().preferences.get(user.id);

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">{t("onboarding.title")}</h1>
        <p className="text-sm text-slate-600">{t("onboarding.subtitle")}</p>
      </header>
      <OnboardingForm
        initial={{ firstName: user.firstName, lastName: user.lastName, birthDate: user.birthDate, pjnJurisdiction: user.pjnJurisdiction }}
        services={services}
      />
    </>
  );
}
