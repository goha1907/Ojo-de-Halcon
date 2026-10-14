import { describe, expect, it } from "vitest";
import { handleStart, type StartHandlerCore } from "./start-handler";

function coreReturning(result: Awaited<ReturnType<StartHandlerCore["telegram"]["confirmFromBot"]>>) {
  const calls: unknown[] = [];
  const core: StartHandlerCore = {
    telegram: {
      confirmFromBot: async (input) => {
        calls.push(input);
        return result;
      },
    },
  };
  return { core, calls };
}

const from = { id: 5, username: "egor" };

describe("handleStart", () => {
  it("greets when there is no payload", async () => {
    const { core, calls } = coreReturning({ ok: true, userId: "u1" });
    expect((await handleStart({ core, payload: "  ", from })).key).toBe("bot.welcome");
    expect(calls).toHaveLength(0);
  });

  it("rejects malformed payloads without touching the database", async () => {
    const { core, calls } = coreReturning({ ok: true, userId: "u1" });
    expect((await handleStart({ core, payload: "../etc/passwd", from })).key).toBe("bot.codeInvalid");
    expect((await handleStart({ core, payload: "x".repeat(65), from })).key).toBe("bot.codeInvalid");
    expect(calls).toHaveLength(0);
  });

  it("maps core results to messages", async () => {
    const cases = [
      [{ ok: true, userId: "u1" }, "bot.linked"],
      [{ ok: false, reason: "EXPIRED" }, "bot.codeExpired"],
      [{ ok: false, reason: "UNKNOWN_CODE" }, "bot.codeInvalid"],
      [{ ok: false, reason: "ALREADY_LINKED" }, "bot.alreadyLinked"],
    ] as const;
    for (const [result, expected] of cases) {
      const { core } = coreReturning(result);
      expect((await handleStart({ core, payload: "abc_DEF-123", from })).key).toBe(expected);
    }
  });

  it("passes the Telegram identity to the core", async () => {
    const { core, calls } = coreReturning({ ok: true, userId: "u1" });
    await handleStart({ core, payload: "code123", from });
    expect(calls[0]).toEqual({ code: "code123", telegram: { id: 5, username: "egor" } });
  });
});
