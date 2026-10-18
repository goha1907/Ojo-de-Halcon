import { describe, expect, it } from "vitest";
import { createResendMailer } from "../mailer";

function stub(status: number, body = "") {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe("Resend mailer", () => {
  it("posts the message with the key, sender and reply-to", async () => {
    const { calls, fetchImpl } = stub(200, '{"id":"1"}');
    const mailer = createResendMailer({ apiKey: "re_test", from: "Ojo <a@b.c>", replyTo: "help@b.c", fetchImpl });
    await mailer.send({ to: "x@y.z", subject: "Hi", text: "plain", html: "<p>rich</p>" });
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      from: "Ojo <a@b.c>",
      to: ["x@y.z"],
      subject: "Hi",
      text: "plain",
      html: "<p>rich</p>",
      reply_to: "help@b.c",
    });
  });

  it("leaves out html and reply-to when there are none", async () => {
    const { calls, fetchImpl } = stub(200);
    await createResendMailer({ apiKey: "k", from: "a@b.c", fetchImpl }).send({ to: "x@y.z", subject: "s", text: "t" });
    expect(Object.keys(JSON.parse(calls[0]!.init.body as string)).sort()).toEqual(["from", "subject", "text", "to"]);
  });

  it("throws when Resend refuses, without leaking the key", async () => {
    const { fetchImpl } = stub(403, '{"message":"domain not verified"}');
    const mailer = createResendMailer({ apiKey: "re_secret", from: "a@b.c", fetchImpl });
    const failure = await mailer.send({ to: "x@y.z", subject: "s", text: "t" }).catch((error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("403");
    expect((failure as Error).message).toContain("domain not verified");
    expect((failure as Error).message).not.toContain("re_secret");
  });
});
