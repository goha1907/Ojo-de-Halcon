"use client";

import { API_ROUTES, SETTINGS_SECTIONS } from "@ojo/shared";
import { Alert, Button, Card } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { ProfileFields, useProfileFields, type ProfileInitial } from "@/components/profile/profile-fields";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { issuesToFieldErrors } from "@/lib/form-errors";

export function ProfileCard({
  initial,
  email,
  emailVerified,
}: {
  initial: ProfileInitial;
  email: string;
  emailVerified: boolean;
}) {
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
    <Card id={SETTINGS_SECTIONS.profile} title={t("settings.profile.title")} description={t("settings.profile.help")}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-fg">{t("settings.profile.email")}</span>
          <div className="flex items-center justify-between gap-3 rounded-field border border-line bg-bg-subtle px-3 py-2 text-sm">
            <span className="min-w-0 truncate text-fg">{email}</span>
            <span
              className={
                emailVerified
                  ? "inline-flex shrink-0 items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success-fg"
                  : "inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-fg"
              }
            >
              <span aria-hidden="true">{emailVerified ? "✓" : "!"}</span>
              {emailVerified ? t("settings.profile.emailVerified") : t("settings.profile.emailUnverified")}
            </span>
          </div>
        </div>
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
