"use client";

import { Select, type SelectOption } from "@ojo/ui";
import { useState } from "react";

/** The language picker. Only the first language works for now, so changing it does nothing yet. */
export function LanguageSelectControl({ label, options }: { label: string; options: readonly SelectOption[] }) {
  const [value, setValue] = useState(options[0]?.value ?? "");
  return (
    <Select
      variant="pill"
      size="sm"
      className="w-[4.75rem] font-medium"
      aria-label={label}
      value={value}
      onChange={setValue}
      options={options}
    />
  );
}
