"use client";

import { API_ROUTES, FEEDBACK_LIMITS, FEEDBACK_TOPICS, feedbackSchema, type MessageKey } from "@ojo/shared";
import { Alert, Button, SelectField, TextField } from "@ojo/ui";
import { useMemo, useState, type FormEvent } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { ApiError, apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";
import { issuesToFieldErrors } from "@/lib/form-errors";

/** "Write to us": a question, a complaint or a suggestion; messages are read in the admin area. */
export function FeedbackForm({ defaultEmail }: { defaultEmail: string }) {
  const t = useT();
  const [topic, setTopic] = useState<string>(FEEDBACK_TOPICS[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const topics = useMemo(
    () => FEEDBACK_TOPICS.map((value) => ({ value, label: t(`feedback.topic.${value}` as MessageKey) })),
    [t],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const payload = { topic, name, email, message, website };
    const parsed = feedbackSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues, t));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await apiRequest(API_ROUTES.feedback, { method: "POST", body: payload });
      setSent(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION") setErrors(issuesToFieldErrors(error.issues, t));
      else setFormError(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <Alert tone="success">{t("feedback.sent")}</Alert>
        <Button
          variant="ghost"
          onClick={() => {
            setSent(false);
            setMessage("");
          }}
        >
          {t("feedback.another")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && <Alert tone="error">{formError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t("feedback.topic")}
          value={topic}
          options={topics}
          onChange={(event) => setTopic(event.target.value)}
        />
        <TextField
          label={t("feedback.name")}
          autoComplete="given-name"
          value={name}
          error={errors.name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <TextField
        label={t("field.email")}
        type="email"
        autoComplete="email"
        value={email}
        error={errors.email}
        hint={t("feedback.emailHint")}
        onChange={(event) => setEmail(event.target.value)}
      />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-fg">{t("feedback.message")}</span>
        <textarea
          rows={5}
          maxLength={FEEDBACK_LIMITS.messageMax}
          value={message}
          aria-invalid={Boolean(errors.message)}
          onChange={(event) => setMessage(event.target.value)}
          className={`block w-full rounded-lg border bg-surface px-3 py-2 text-sm text-fg shadow-sm focus:outline-2 focus:outline-ring ${
            errors.message ? "border-error" : "border-line"
          }`}
        />
        {errors.message && <span className="block text-xs text-error-fg">{errors.message}</span>}
        <span className="block text-right text-xs text-fg-muted">
          {message.length} / {FEEDBACK_LIMITS.messageMax}
        </span>
      </label>
      {/* honeypot: hidden from people, filled by bots */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </label>
      </div>
      <Button type="submit" loading={busy}>
        {t("feedback.submit")}
      </Button>
    </form>
  );
}
