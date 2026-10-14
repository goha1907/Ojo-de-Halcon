import { describe, expect, it } from "vitest";
import { feedbackSchema } from "../domain/feedback";

describe("feedbackSchema", () => {
  const ok = { topic: "tracking", name: "", email: " Ana@Example.com ", message: "Как добавить отслеживание?" };

  it("trims, normalizes the e-mail and makes a blank name null", () => {
    const parsed = feedbackSchema.parse(ok);
    expect(parsed).toMatchObject({ email: "ana@example.com", name: null, website: "" });
  });

  it("needs a topic from the list, a real e-mail and a message of some length", () => {
    expect(feedbackSchema.safeParse({ ...ok, topic: "spam" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...ok, email: "no-at" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...ok, message: "hi" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...ok, message: "x".repeat(2001) }).success).toBe(false);
  });
});
