import { APP_CONFIG, createTranslator, resolveLocale, type Locale, type MessageKey } from "@ojo/shared";
import { renderLayout } from "./layout";

/** The e-mails the service can send. `verify` and `reset` go out today; the others have their template ready. */
export type EmailKind =
  | "verify"
  | "reset"
  | "passwordChanged"
  | "welcome"
  | "paymentReceipt"
  | "bonusEnding"
  | "subscriptionEnding"
  | "supportReply";

export const EMAIL_KINDS: readonly EmailKind[] = [
  "verify",
  "reset",
  "passwordChanged",
  "welcome",
  "paymentReceipt",
  "bonusEnding",
  "subscriptionEnding",
  "supportReply",
];

/** Everything a message may need; each kind reads only its own fields. */
export interface EmailData {
  name?: string | null;
  /** The button target: confirmation or reset link; for the other kinds the page opens on the site. */
  link?: string;
  hours?: number;
  minutes?: number;
  days?: number;
  /** A date already written for the reader (`Intl`, long form). */
  date?: string;
  count?: number;
  amount?: string;
  places?: number;
  /** Support reply: what the customer wrote and what was answered. */
  question?: string;
  reply?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const key = (kind: EmailKind, field: string) => `email.${kind}.${field}` as MessageKey;

/** The page a message's button opens when it has no token link of its own. */
const PAGE: Partial<Record<EmailKind, string>> = {
  passwordChanged: "/forgot-password",
  welcome: "/dashboard",
  paymentReceipt: "/settings/subscription",
  bonusEnding: "/settings/subscription",
  subscriptionEnding: "/settings/subscription",
};

export function renderEmail(
  kind: EmailKind,
  context: { locale: string; appUrl: string; data?: EmailData },
): RenderedEmail {
  const locale: Locale = resolveLocale(context.locale);
  const t = createTranslator(locale);
  const data = context.data ?? {};
  const params = {
    hours: data.hours ?? 0,
    minutes: data.minutes ?? 0,
    days: data.days ?? APP_CONFIG.limits.trialDays,
    date: data.date ?? "",
    count: data.count ?? 0,
    email: APP_CONFIG.contact.supportEmail,
  };
  // A kind carries only the parts it needs; a missing key reads as undefined.
  const has = (field: string) => (t(key(kind, field)) as string | undefined) !== undefined;

  const paragraphs = [t(key(kind, "intro"), params)];
  if (has("more")) paragraphs.push(t(key(kind, "more"), params));

  const facts =
    kind === "paymentReceipt"
      ? [
          { label: t(key(kind, "amount")), value: data.amount ?? "" },
          { label: t(key(kind, "places")), value: String(data.places ?? 0) },
          { label: t(key(kind, "until")), value: data.date ?? "" },
        ]
      : undefined;

  const url = data.link ?? (PAGE[kind] ? `${context.appUrl}${PAGE[kind]}` : undefined);
  const button = has("button") && url ? { label: t(key(kind, "button")), url } : undefined;
  const note = has("note") ? t(key(kind, "note"), params) : undefined;
  const greeting = data.name ? t("email.greetingName", { name: data.name }) : t("email.greeting");
  const footer = [
    t("email.footer.support", params),
    t("landing.footer.disclaimer"),
    t("email.footer.reason"),
  ];
  const title = t(key(kind, "title"));
  const subject = t(key(kind, "subject"));
  const linkFallback = t("email.linkFallback");

  const html = renderLayout({
    lang: locale,
    preheader: paragraphs[0]!,
    title,
    greeting,
    paragraphs: kind === "supportReply" ? [paragraphs[0]!] : paragraphs,
    ...(kind === "supportReply" && data.question ? { quote: data.question } : {}),
    ...(kind === "supportReply" ? { reply: { label: t(key(kind, "answer")), text: data.reply ?? "" } } : {}),
    ...(facts ? { facts } : {}),
    ...(button ? { button, ...(data.link ? { linkFallback } : {}) } : {}),
    ...(note ? { note } : {}),
    footer,
    logoUrl: `${context.appUrl}/images/brand/logo-dark.png`,
    siteUrl: context.appUrl,
    brandName: t("app.name"),
  });

  const lines = [title, "", greeting, "", ...paragraphs];
  if (kind === "supportReply") {
    if (data.question) lines.push("", `> ${data.question.replace(/\n/g, "\n> ")}`);
    lines.push("", t(key(kind, "answer")), data.reply ?? "");
  }
  if (facts) lines.push("", ...facts.map((fact) => `${fact.label}: ${fact.value}`));
  if (button) lines.push("", `${button.label}: ${button.url}`);
  if (note) lines.push("", note);
  lines.push("", "--", ...footer);
  return { subject, html, text: lines.join("\n") };
}
