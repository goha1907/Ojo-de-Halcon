"use client";

import type { MessageKey } from "@ojo/shared";
import { Modal } from "@ojo/ui";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";

export const LEGAL_DOCUMENTS = [
  "terms",
  "privacy",
  "security",
  "payment",
  "cancellation",
  "refund",
  "gdpr",
  "cookies",
  "manageCookies",
] as const;
type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];

/** Policy links of the footer; each opens its (placeholder) text in a modal, so no extra pages exist. */
export function LegalLinks() {
  const t = useT();
  const [open, setOpen] = useState<LegalDocument | null>(null);
  const title = (doc: LegalDocument) => t(`landing.legal.${doc}` as MessageKey);

  return (
    <>
      <ul className="space-y-2 text-sm">
        {LEGAL_DOCUMENTS.map((doc) => (
          <li key={doc}>
            <button type="button" onClick={() => setOpen(doc)} className="text-slate-300 hover:text-white">
              {title(doc)}
            </button>
          </li>
        ))}
      </ul>
      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? title(open) : ""}
        closeLabel={t("landing.legal.close")}
      >
        <p className="text-sm text-slate-600">{t("landing.legal.stub")}</p>
      </Modal>
    </>
  );
}
