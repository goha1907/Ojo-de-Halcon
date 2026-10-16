"use client";

import { API_ROUTES, ROUTES } from "@ojo/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/api-client";

export function AdminSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try {
      await apiRequest(API_ROUTES.logout, { method: "POST" });
    } finally {
      router.replace(ROUTES.login);
      router.refresh();
    }
  }
  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={busy}
      className="rounded-field border border-line px-3 py-1 text-sm hover:bg-line/40 disabled:opacity-50"
    >
      Sign out
    </button>
  );
}
