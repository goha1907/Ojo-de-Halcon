import type { TranslateFn } from "@ojo/shared";
import { ApiError } from "./api-client";

/** Human text for errors that are common to all forms. */
export function describeApiError(error: unknown, t: TranslateFn): string {
  if (error instanceof ApiError) {
    if (error.code === "RATE_LIMITED") return t("common.rateLimited");
    if (error.code === "NOT_CONFIGURED") return t("common.notConfigured");
    if (error.code === "EMAIL_NOT_VERIFIED") return t("common.emailNotVerified");
    if (error.code === "SUBSCRIPTION_REQUIRED") return t("track.error.subscription");
  }
  return t("common.genericError");
}
