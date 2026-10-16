"use client";

import { API_ROUTES, ROUTES } from "@ojo/shared";
import { Button, LogoutIcon } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";

/** `label` is a small icon-and-text tag for tight places (the cabinet menu); the others are full buttons. */
export function LogoutButton({
  variant = "ghost",
  fullWidth = false,
}: {
  variant?: "ghost" | "secondary" | "label";
  fullWidth?: boolean;
}) {
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

  if (variant === "label") {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={logout}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-line/40 hover:text-fg focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
      >
        <LogoutIcon className="size-4" />
        {t("common.logout")}
      </button>
    );
  }

  return (
    <Button variant={variant} fullWidth={fullWidth} loading={loading} onClick={logout}>
      {t("common.logout")}
    </Button>
  );
}
