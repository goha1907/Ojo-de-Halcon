/**
 * Throw-away mailbox providers. A trial cannot be tied to an address that is
 * created for a few minutes, so registration rejects these domains. The list is
 * a starting point and is meant to be extended.
 */
export const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com",
  "10minutemail.com",
  "10minutemail.net",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "sharklasers.com",
  "grr.la",
  "temp-mail.org",
  "tempmail.com",
  "tempmail.net",
  "temp-mail.io",
  "tempail.com",
  "yopmail.com",
  "yopmail.net",
  "trashmail.com",
  "trashmail.net",
  "throwawaymail.com",
  "getnada.com",
  "nada.email",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mintemail.com",
  "mohmal.com",
  "emailondeck.com",
  "burnermail.io",
  "spamgourmet.com",
  "moakt.com",
  "mailnesia.com",
  "mytemp.email",
  "discard.email",
  "mailcatch.com",
  "inboxkitten.com",
  "tmpmail.org",
  "tmpmail.net",
  "dropmail.me",
  "minuteinbox.com",
  "fakemail.net",
  "emailfake.com",
]);

/** Domains where dots in the local part are ignored and `googlemail.com` is an alias. */
export const GMAIL_DOMAINS: readonly string[] = ["gmail.com", "googlemail.com"];
