export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /** Rich version; clients without HTML show `text`. */
  html?: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/**
 * Development mailer: writes the message to the process output instead of
 * sending it. Swap for an SMTP/API implementation once a provider is chosen.
 */
export function createConsoleMailer(write: (line: string) => void = (line) => process.stdout.write(`${line}\n`)): Mailer {
  return {
    async send(message) {
      write(JSON.stringify({ level: "info", message: "mail (console driver, not sent)", mail: message }));
    },
  };
}

/**
 * Sends through the Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email). A message that
 * the API refuses throws, so the caller sees the failure; the key is never written to logs.
 */
export function createResendMailer(options: {
  apiKey: string;
  /** `Name <address@verified-domain>`; until a domain is verified Resend only allows `onboarding@resend.dev`. */
  from: string;
  replyTo?: string;
  fetchImpl?: typeof fetch;
}): Mailer {
  const request = options.fetchImpl ?? fetch;
  return {
    async send(message) {
      const response = await request("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: options.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          ...(options.replyTo ? { reply_to: options.replyTo } : {}),
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Resend refused the message (${response.status}): ${detail.slice(0, 300)}`);
      }
    },
  };
}
