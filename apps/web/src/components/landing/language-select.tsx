"use client";

import { API_ROUTES, type Locale } from "@ojo/shared";
import { Select, type SelectOption } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";

const OPTIONS: readonly SelectOption[] = [
  { value: "ru", label: "RU" },
  { value: "es", label: "ES" },
  { value: "en", label: "EN" },
];

/** The language picker: remembers the choice (cookie, and the profile when signed in) and reloads the page in it. */
export function LanguageSelectControl({ label }: { label: string }) {
  const { locale } = useI18n();
  const router = useRouter();
  const [value, setValue] = useState<string>(locale);

  async function change(next: string) {
    setValue(next);
    try {
      await apiRequest(API_ROUTES.locale, { method: "PUT", body: { locale: next as Locale } });
      router.refresh();
    } catch {
      setValue(locale);
    }
  }

  return (
    <Select
      variant="pill"
      size="sm"
      className="w-[4.75rem] font-medium"
      aria-label={label}
      value={value}
      onChange={(next) => void change(next)}
      options={OPTIONS}
    />
  );
}
