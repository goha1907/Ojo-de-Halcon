import type { MessageKey } from "@ojo/shared";

/** The slice of core services the handler needs (keeps it easy to test). */
export interface StartHandlerCore {
  telegram: {
    confirmFromBot(input: {
      code: string;
      telegram: { id: number; username?: string | null };
    }): Promise<
      | { ok: true }
      | { ok: false; reason: "UNKNOWN_CODE" | "EXPIRED" | "ALREADY_LINKED" }
    >;
  };
}

/** Telegram allows 1-64 chars of [A-Za-z0-9_-] in a /start payload. */
const PAYLOAD_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Decides which message to answer for `/start [payload]` (linking Telegram to an account). */
export async function handleStart(input: {
  core: StartHandlerCore;
  payload: string;
  from: { id: number; username?: string | undefined };
}): Promise<MessageKey> {
  const payload = input.payload.trim();
  if (!payload) return "bot.welcome";
  if (!PAYLOAD_PATTERN.test(payload)) return "bot.codeInvalid";

  const result = await input.core.telegram.confirmFromBot({
    code: payload,
    telegram: { id: input.from.id, username: input.from.username ?? null },
  });
  if (result.ok) return "bot.linked";

  switch (result.reason) {
    case "EXPIRED":
      return "bot.codeExpired";
    case "ALREADY_LINKED":
      return "bot.alreadyLinked";
    default:
      return "bot.codeInvalid";
  }
}
