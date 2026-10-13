"use client";

import { API_ROUTES } from "@ojo/shared";
import { Alert, Button, Card } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { ProfileFields, useProfileFields, type ProfileInitial } from "@/components/profile/profile-fields";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { issuesToFieldErrors } from "@/lib/form-errors";

export function ProfileCard({ initial, email }: { initial: ProfileInitial; email: string }) {
  const t = useT();
  const router = useRouter();
  const profile = useProfileFields(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "locked" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("idle");
    const payload = profile.validate();
    if (!payload) return;
    setStatus("saving");
    try {
      await apiRequest(API_ROUTES.profile, { method: "PUT", body: payload });
      setStatus("saved");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === "VALIDATION") {
        profile.setErrors(issuesToFieldErrors(e.issues, t));
        setStatus("idle");
      } else if (e instanceof ApiError && e.code === "FORBIDDEN") {
        setStatus("locked");
      } else {
        setError(describeApiError(e, t));
        setStatus("error");
      }
    }
  }

  return (
    <Card title={t("settings.profile.title")} description={t("settings.profile.help")}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <p className="text-sm text-slate-600">{t("settings.profile.email", { email })}</p>
        {status === "saved" && <Alert tone="success">{t("common.saved")}</Alert>}
        {status === "locked" && <Alert tone="error">{t("settings.profile.locked")}</Alert>}
        {status === "error" && <Alert tone="error">{error}</Alert>}
        <ProfileFields state={profile} />
        <Button type="submit" loading={status === "saving"}>
          {t("common.save")}
        </Button>
      </form>
    </Card>
  );
}
