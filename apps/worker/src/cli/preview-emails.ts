import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { EMAIL_KINDS, renderEmail } from "@ojo/core";
import { LOCALES } from "@ojo/shared";

// Writes every e-mail in every language as an .html file to open in a browser: `pnpm emails:preview [dir]`.
const dir = process.argv[2] ?? "email-preview";
const appUrl = process.env.APP_URL ?? "http://localhost:3000";

await mkdir(dir, { recursive: true });
for (const locale of LOCALES) {
  for (const kind of EMAIL_KINDS) {
    const mail = renderEmail(kind, {
      locale,
      appUrl,
      data: {
        name: "Ana",
        link: `${appUrl}/verify-email?token=example`,
        hours: 48,
        minutes: 60,
        days: 7,
        date: "17 / 11 / 2026",
        count: 2,
        amount: "USD 9.00",
        places: 5,
        question: "¿En qué estado está mi expediente?",
        reply: "Sigue en trámite; te avisaremos de cualquier cambio.",
      },
    });
    await writeFile(join(dir, `${kind}.${locale}.html`), mail.html);
  }
}
process.stdout.write(`Written to ${dir}/ (${EMAIL_KINDS.length * LOCALES.length} files)\n`);
