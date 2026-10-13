"use client";

import { API_ROUTES, ROUTES } from "@ojo/shared";
import { Alert, Button, Card } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { ProfileFields, useProfileFields, type ProfileInitial } from "@/components/profile/profile-fields";
import { ServiceCheckboxes, type ServiceValues } from "@/components/services/service-checkboxes";
import { apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";

interface Props {
  initial: ProfileInitial;
  services: ServiceValues;
}

/** Optional step after registration: profile + which services to follow. */
export function OnboardingForm({ initial, services: initialServices }: Props) {
  const t = useT();
  const router = useRouter();
  const profile = useProfileFields(initial);
  const [services, setServices] = useState(initialServices);
  const [loading, setLoading] = useState<"save" | "skip" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function finish(mode: "save" | "skip") {
    setFormError(null);
    let profilePayload = null;
    if (mode === "save" && !profile.isEmpty) {
      profilePayload = profile.validate();
      if (!profilePayload) return;
    }
    setLoading(mode);
    try {
      if (profilePayload) await apiRequest(API_ROUTES.profile, { method: "PUT", body: profilePayload });
      await apiRequest(API_ROUTES.services, {
        method: "PUT",
        body: { services: mode === "save" ? services : {}, completeOnboarding: true },
      });
      router.replace(ROUTES.dashboard);
      router.refresh();
    } catch (error) {
      setFormError(describeApiError(error, t));
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {formError && <Alert tone="error">{formError}</Alert>}
      <Card title={t("onboarding.profile")}>
        <ProfileFields state={profile} />
      </Card>
      <Card title={t("onboarding.services")} description={t("onboarding.servicesHelp")}>
        <ServiceCheckboxes values={services} onChange={setServices} />
      </Card>
      <div className="flex items-center gap-3">
        <Button loading={loading === "save"} disabled={loading === "skip"} onClick={() => finish("save")}>
          {t("onboarding.submit")}
        </Button>
        <Button variant="ghost" loading={loading === "skip"} disabled={loading === "save"} onClick={() => finish("skip")}>
          {t("common.skip")}
        </Button>
      </div>
    </div>
  );
}
