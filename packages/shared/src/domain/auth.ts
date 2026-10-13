/** Why linking a Telegram account was refused. Shown via i18n (`telegram.failure.<reason>`). */
export const TELEGRAM_LINK_FAILURES = ["ALREADY_LINKED"] as const;
export type TelegramLinkFailure = (typeof TELEGRAM_LINK_FAILURES)[number];

/** Link that opens the bot with the one-time code as the /start payload. */
export function buildBotDeepLink(botUsername: string, code: string): string {
  return `https://t.me/${botUsername}?start=${code}`;
}
