import { translateLoose, type TranslateFn } from "@ojo/shared";
import type { ApiIssue } from "./api-client";

/** First message per top-level field, translated. */
export function issuesToFieldErrors(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> | ApiIssue[],
  t: TranslateFn,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "_form");
    if (!(field in errors)) errors[field] = translateLoose(t, issue.message);
  }
  return errors;
}
