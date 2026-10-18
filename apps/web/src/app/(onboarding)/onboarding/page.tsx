import { ROUTES } from "@ojo/shared";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { getT } from "@/server/i18n";
import { requireUser } from "@/server/session";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboardingDone) redirect(ROUTES.dashboard);
  const { t } = await getT();

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-fg">{t("onboarding.title")}</h1>
        <p className="text-sm text-fg-muted">{t("onboarding.subtitle")}</p>
      </header>
      <OnboardingForm
        initial={{ firstName: user.firstName, lastName: user.lastName, birthDate: user.birthDate }}
      />
    </>
  );
}
