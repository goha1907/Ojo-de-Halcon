import type { MessageKey } from "@ojo/shared";

/** The slice of core services the handler needs (keeps it easy to test). */
export interface StartHandlerCore {
  telegram: {
    confirmFromBot(input: {
      code: string;
      telegram: { id: number; username?: string | null };
    }): Promise<
      | { ok: true; userId: string }
      | { ok: false; reason: "UNKNOWN_CODE" | "EXPIRED" | "ALREADY_LINKED" }
    >;
  };
}

/** Telegram allows 1-64 chars of [A-Za-z0-9_-] in a /start payload. */
const PAYLOAD_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Which message to answer, and the account that was just linked (if any). */
export interface StartOutcome {
  key: MessageKey;
  linkedUserId: string | null;
}

/** Decides which message to answer for `/start [payload]` (linking Telegram to an account). */
export async function handleStart(input: {
  core: StartHandlerCore;
  payload: string;
  from: { id: number; username?: string | undefined };
}): Promise<StartOutcome> {
  const payload = input.payload.trim();
  if (!payload) return { key: "bot.welcome", linkedUserId: null };
  if (!PAYLOAD_PATTERN.test(payload)) return { key: "bot.codeInvalid", linkedUserId: null };

  const result = await input.core.telegram.confirmFromBot({
    code: payload,
    telegram: { id: input.from.id, username: input.from.username ?? null },
  });
  if (result.ok) return { key: "bot.linked", linkedUserId: result.userId };

  switch (result.reason) {
    case "EXPIRED":
      return { key: "bot.codeExpired", linkedUserId: null };
    case "ALREADY_LINKED":
      return { key: "bot.alreadyLinked", linkedUserId: null };
    default:
      return { key: "bot.codeInvalid", linkedUserId: null };
  }
}
