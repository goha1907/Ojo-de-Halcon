import type { UserDto } from "@ojo/core";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { clientIp, rateLimit } from "./rate-limit";
import { getCurrentUser } from "./session";

export type ApiErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED"
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "INVALID_CREDENTIALS"
  | "EMAIL_TAKEN"
  | "INVALID_TOKEN"
  | "INVALID_PASSWORD"
  | "ALREADY_EXISTS"
  | "SECTION_BUSY"
  | "NOT_FOUND"
  | "SOURCE_DOWN"
  | "PROFILE_INCOMPLETE"
  | "NO_COURT"
  | "PERSON_NOT_FOUND"
  | "SUBSCRIPTION_REQUIRED"
  | "LIMIT_REACHED";

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION: 422,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  NOT_CONFIGURED: 503,
  FORBIDDEN: 403,
  BAD_REQUEST: 400,
  INVALID_CREDENTIALS: 401,
  EMAIL_TAKEN: 409,
  INVALID_TOKEN: 400,
  INVALID_PASSWORD: 403,
  ALREADY_EXISTS: 409,
  SECTION_BUSY: 409,
  NOT_FOUND: 404,
  SOURCE_DOWN: 503,
  PROFILE_INCOMPLETE: 409,
  NO_COURT: 409,
  PERSON_NOT_FOUND: 404,
  SUBSCRIPTION_REQUIRED: 402,
  LIMIT_REACHED: 409,
};

export function apiError(code: ApiErrorCode, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, ...extra }, { status: STATUS[code] });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Parses a JSON body with `schema`; answers 422 with translatable issue keys on failure. */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  const parsed = schema.safeParse(await readJson(request));
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    response: apiError("VALIDATION", {
      issues: parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
    }),
  };
}

/** Per-IP fixed-window limit; returns a 429 response when exceeded. */
export function limitByIp(
  request: Request,
  name: string,
  limit: { windowMs: number; max: number },
): Response | null {
  return rateLimit(`${name}:${clientIp(request.headers)}`, limit).allowed ? null : apiError("RATE_LIMITED");
}

/** Runs `handler` for the signed-in user or answers 401. */
export async function withUser(handler: (user: UserDto) => Promise<Response>): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED");
  return handler(user);
}

/** Per-user fixed-window limit; returns a 429 response when exceeded. */
export function limitByUser(
  userId: string,
  name: string,
  limit: { windowMs: number; max: number },
): Response | null {
  return rateLimit(`${name}:${userId}`, limit).allowed ? null : apiError("RATE_LIMITED");
}
