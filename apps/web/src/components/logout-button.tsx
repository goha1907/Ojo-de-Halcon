"use client";

import { API_ROUTES, ROUTES } from "@ojo/shared";
import { Button } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";

export function LogoutButton() {
  const t = useT();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await apiRequest(API_ROUTES.logout, { method: "POST" });
    } finally {
      router.replace(ROUTES.login);
      router.refresh();
    }
  }

  return (
    <Button variant="ghost" loading={loading} onClick={logout}>
      {t("common.logout")}
    </Button>
  );
}
