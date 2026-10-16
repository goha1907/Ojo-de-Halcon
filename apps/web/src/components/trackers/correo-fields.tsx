"use client";

import { CORREO_FORM_KEYS, CORREO_FORMS, correoFormUrl, type CorreoFormKey, type MessageKey } from "@ojo/shared";
import { SelectField, TextField } from "@ojo/ui";
import { useMemo } from "react";
import { useT } from "@/components/providers/i18n-provider";

export interface CorreoValue {
  form: CorreoFormKey;
  producto: string;
  number: string;
}

/** First prefix of a form (what its page preselects); empty for forms without prefixes. */
export function defaultProducto(form: CorreoFormKey): string {
  const def = CORREO_FORMS[form];
  return "products" in def ? def.products[0] : "";
}

/**
 * Fields of one Correo tracking form: the type list is the site's own ("Tipo de envío") and each
 * type shows only the fields its page has.
 */
export function CorreoFields({
  value,
  errors,
  onChange,
  lockForm = false,
}: {
  value: CorreoValue;
  errors: Record<string, string>;
  onChange: (next: CorreoValue) => void;
  /** Replacing the code of an existing case keeps its type. */
  lockForm?: boolean;
}) {
  const t = useT();
  const formOptions = useMemo(
    () => CORREO_FORM_KEYS.map((key) => ({ value: key, label: t(`track.correo.form.${key}` as MessageKey) })),
    [t],
  );
  const def = CORREO_FORMS[value.form];
  const products = "products" in def ? def.products : null;
  const numberLabel: MessageKey =
    def.layout === "coded"
      ? "track.correo.number"
      : def.layout === "upu"
        ? "track.correo.code"
        : def.layout === "tramite"
          ? "track.field.tramite"
          : "track.correo.parcel";

  return (
    <div className="space-y-4">
      {!lockForm && (
        <SelectField
          label={t("track.correo.type")}
          value={value.form}
          options={formOptions}
          onChange={(e) => {
            const form = e.target.value as CorreoFormKey;
            onChange({ form, producto: defaultProducto(form), number: "" });
          }}
        />
      )}
      <div className="flex items-start gap-3">
        {products && (
          <div className="w-28 shrink-0">
            <SelectField
              label={t("track.correo.product")}
              value={value.producto}
              options={products.map((item) => ({ value: item, label: item }))}
              error={errors.producto}
              onChange={(e) => onChange({ ...value, producto: e.target.value })}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <TextField
            label={t(numberLabel)}
            inputMode={def.layout === "upu" || def.layout === "parcel" ? "text" : "numeric"}
            maxLength={def.maxLength + 4}
            value={value.number}
            error={errors.number}
            onChange={(e) => onChange({ ...value, number: e.target.value })}
          />
        </div>
      </div>
      <p className="text-xs text-fg-muted">
        {t(`track.correo.hint.${def.layout}` as MessageKey)}{" "}
        <a
          href={correoFormUrl(value.form)}
          target="_blank"
          rel="noreferrer"
          className="text-fg underline underline-offset-2 hover:text-fg-muted"
        >
          correoargentino.com.ar
        </a>
      </p>
    </div>
  );
}
