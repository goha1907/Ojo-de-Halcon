export interface MailMessage {
  to: string;
  subject: string;
  text: string;
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
