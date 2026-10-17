"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/api-client";

export function DeleteNews({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!window.confirm("Delete this entry in all languages?")) return;
    setBusy(true);
    try {
      await apiRequest(`/api/admin/news/${slug}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button onClick={() => void remove()} disabled={busy} className="rounded-field border border-line px-3 py-1 text-xs text-error-fg hover:bg-line/40 disabled:opacity-50">
      Delete
    </button>
  );
}
