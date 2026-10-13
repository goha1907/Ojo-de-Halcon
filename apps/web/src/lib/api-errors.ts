import type { TranslateFn } from "@ojo/shared";
import { ApiError } from "./api-client";

/** Human text for errors that are common to all forms. */
export function describeApiError(error: unknown, t: TranslateFn): string {
  if (error instanceof ApiError) {
    if (error.code === "RATE_LIMITED") return t("common.rateLimited");
    if (error.code === "NOT_CONFIGURED") return t("common.notConfigured");
  }
  return t("common.genericError");
}
