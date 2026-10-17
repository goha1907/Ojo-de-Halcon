/**
 * The shell of every e-mail: a graphite header with the white logo, a white card with the text and one button,
 * a quiet footer. Table layout and inline styles only (mail clients ignore the rest). Clients that honour
 * `prefers-color-scheme` get the dark palette of the site; the header is dark in both, so the logo always reads.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface LayoutInput {
  lang: string;
  /** Text clients show next to the subject. */
  preheader: string;
  title: string;
  greeting: string;
  /** Plain paragraphs; line breaks inside are kept. */
  paragraphs: string[];
  /** A quoted passage (the customer's question in a support reply). */
  quote?: string;
  /** The answer under the quote (support reply). */
  reply?: { label: string; text: string };
  /** Label and value rows (a payment receipt). */
  facts?: Array<{ label: string; value: string }>;
  button?: { label: string; url: string };
  /** The line under the button: what to do if it was not you. */
  note?: string;
  linkFallback?: string;
  footer: string[];
  /** Absolute address of the white logo (PNG) and the site, for the header. */
  logoUrl: string;
  siteUrl: string;
  brandName: string;
}

const C = {
  page: "#F8FAFC",
  card: "#FFFFFF",
  ink: "#111827",
  muted: "#6B7280",
  line: "#E5E7EB",
  brand: "#1F2937",
  brandInk: "#FFFFFF",
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

const paragraph = (text: string) =>
  `<p class="txt" style="margin:0 0 16px;font:400 16px/1.6 ${FONT};color:${C.ink};">${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;

export function renderLayout(input: LayoutInput): string {
  const reply = input.reply
    ? `<p class="muted" style="margin:0 0 6px;font:600 13px/1.4 ${FONT};color:${C.muted};">${escapeHtml(input.reply.label)}</p>${paragraph(input.reply.text)}`
    : "";
  const facts = input.facts?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="line" style="margin:8px 0 24px;border:1px solid ${C.line};border-radius:16px;border-collapse:separate;">${input.facts
        .map(
          (fact, index) =>
            `<tr><td class="muted" style="padding:14px 18px;font:400 14px/1.4 ${FONT};color:${C.muted};${index > 0 ? `border-top:1px solid ${C.line};` : ""}">${escapeHtml(fact.label)}</td><td align="right" class="txt" style="padding:14px 18px;font:600 15px/1.4 ${FONT};color:${C.ink};${index > 0 ? `border-top:1px solid ${C.line};` : ""}">${escapeHtml(fact.value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const quote = input.quote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td class="quote" style="padding:12px 16px;border-left:4px solid ${C.line};font:italic 400 15px/1.55 ${FONT};color:${C.muted};">${escapeHtml(input.quote).replace(/\n/g, "<br>")}</td></tr></table>`
    : "";
  const button = input.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td class="btn" bgcolor="${C.brand}" style="border-radius:999px;background:${C.brand};"><a href="${escapeHtml(input.button.url)}" class="btn-link" style="display:inline-block;padding:15px 30px;font:600 16px/1 ${FONT};color:${C.brandInk};text-decoration:none;border-radius:999px;">${escapeHtml(input.button.label)}</a></td></tr></table>`
    : "";
  const fallback =
    input.button && input.linkFallback
      ? `<p class="muted" style="margin:0 0 20px;font:400 13px/1.55 ${FONT};color:${C.muted};">${escapeHtml(input.linkFallback)}<br><a href="${escapeHtml(input.button.url)}" class="muted" style="color:${C.muted};word-break:break-all;">${escapeHtml(input.button.url)}</a></p>`
      : "";
  const note = input.note
    ? `<p class="muted" style="margin:0 0 4px;font:400 14px/1.55 ${FONT};color:${C.muted};">${escapeHtml(input.note)}</p>`
    : "";

  return `<!doctype html>
<html lang="${escapeHtml(input.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(input.title)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .bg-page { background:#0F172A !important; }
    .card { background:#1E293B !important; }
    .txt { color:#F9FAFB !important; }
    .muted { color:#CBD5E1 !important; }
    .line { border-color:#334155 !important; }
    .quote { border-left-color:#334155 !important; color:#CBD5E1 !important; }
    .btn { background:#FFFFFF !important; }
    .btn-link { color:#0F172A !important; }
  }
  @media (max-width: 620px) { .wrap { width:100% !important; } .pad { padding:28px 22px !important; } }
</style>
</head>
<body class="bg-page" style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg-page" style="background:${C.page};">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="wrap" style="width:600px;max-width:100%;">
      <tr><td bgcolor="${C.brand}" style="background:${C.brand};border-radius:24px 24px 0 0;padding:26px 36px;">
        <a href="${escapeHtml(input.siteUrl)}" style="text-decoration:none;"><img src="${escapeHtml(input.logoUrl)}" width="168" alt="${escapeHtml(input.brandName)}" style="display:block;border:0;height:auto;font:700 20px ${FONT};color:#FFFFFF;"></a>
      </td></tr>
      <tr><td class="card pad" bgcolor="${C.card}" style="background:${C.card};padding:36px;border-radius:0 0 24px 24px;">
        <h1 class="txt" style="margin:0 0 20px;font:700 26px/1.25 ${FONT};letter-spacing:-0.02em;color:${C.ink};">${escapeHtml(input.title)}</h1>
        <p class="txt" style="margin:0 0 16px;font:600 16px/1.6 ${FONT};color:${C.ink};">${escapeHtml(input.greeting)}</p>
        ${input.paragraphs.map(paragraph).join("\n        ")}
        ${quote}
        ${reply}
        ${facts}
        ${button}
        ${fallback}
        ${note}
      </td></tr>
      <tr><td style="padding:22px 12px 0;text-align:center;">
        ${input.footer.map((line) => `<p class="muted" style="margin:0 0 6px;font:400 12px/1.55 ${FONT};color:${C.muted};">${escapeHtml(line)}</p>`).join("\n        ")}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`;
}
