import { LOCALES } from "@ojo/shared";
import { describe, expect, it } from "vitest";
import { EMAIL_KINDS, renderEmail, type EmailData } from "../mail/templates";

const APP_URL = "https://ojo.test";
const DATA: EmailData = {
  name: "Ana",
  link: "https://ojo.test/verify-email?token=abc",
  hours: 48,
  minutes: 60,
  days: 7,
  date: "17 de noviembre de 2026",
  count: 2,
  amount: "USD 9.00",
  places: 5,
  question: "Where is my case?",
  reply: "It is in the second court.",
};

describe("e-mail templates", () => {
  for (const locale of LOCALES) {
    for (const kind of EMAIL_KINDS) {
      it(`renders ${kind} in ${locale} with nothing left unresolved`, () => {
        const mail = renderEmail(kind, { locale, appUrl: APP_URL, data: DATA });
        for (const part of [mail.subject, mail.html, mail.text]) {
          expect(part).not.toMatch(/\{[a-zA-Z]+\}/);
          expect(part).not.toMatch(/email\.[a-zA-Z]+\./);
        }
        expect(mail.subject.length).toBeGreaterThan(3);
        expect(mail.html).toContain(`lang="${locale}"`);
        expect(mail.html).toContain(`${APP_URL}/images/brand/logo-dark.png`);
        expect(mail.html).toContain("prefers-color-scheme: dark");
        expect(mail.text).toContain("support@");
      });
    }
  }

  it("puts the link into the button and the plain text", () => {
    const mail = renderEmail("reset", { locale: "ru", appUrl: APP_URL, data: DATA });
    expect(mail.html).toContain(`href="${DATA.link}"`);
    expect(mail.text).toContain(DATA.link);
  });

  it("opens the subscription page for notices without a token link", () => {
    const mail = renderEmail("bonusEnding", { locale: "en", appUrl: APP_URL, data: { date: "x", count: 1 } });
    expect(mail.html).toContain(`href="${APP_URL}/settings/subscription"`);
  });

  it("escapes what the customer typed", () => {
    const mail = renderEmail("supportReply", {
      locale: "en",
      appUrl: APP_URL,
      data: { name: "<b>x</b>", question: "<script>alert(1)</script>", reply: "ok" },
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<b>x</b>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("greets by name when it is known", () => {
    expect(renderEmail("welcome", { locale: "en", appUrl: APP_URL, data: { name: "Ana" } }).text).toContain("Ana");
  });
});

describe("support reply", () => {
  it("carries the answer in both versions", () => {
    const mail = renderEmail("supportReply", { locale: "en", appUrl: APP_URL, data: { question: "Q?", reply: "The answer." } });
    expect(mail.html).toContain("The answer.");
    expect(mail.text).toContain("The answer.");
  });
});
