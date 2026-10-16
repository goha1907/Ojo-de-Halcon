import type { UserDto } from "@ojo/core";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { getEnv } from "./env";
import { clientIp, rateLimit } from "./rate-limit";
import { can, isStaff, type AdminPermission } from "@ojo/shared";
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
  | "NO_FREE_SLOT"
  | "BIRTH_DATE_REQUIRED"
  | "MISMATCH"
  | "NOT_FOUND"
  | "SOURCE_DOWN"
  | "PROFILE_INCOMPLETE"
  | "NO_COURT"
  | "SUBSCRIPTION_REQUIRED"
  | "LIMIT_REACHED"
  | "EMAIL_NOT_VERIFIED"
  | "INVALID_CASES"
  | "NO_CASES";

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
  NO_FREE_SLOT: 409,
  BIRTH_DATE_REQUIRED: 409,
  MISMATCH: 409,
  NOT_FOUND: 404,
  SOURCE_DOWN: 503,
  PROFILE_INCOMPLETE: 409,
  NO_COURT: 409,
  SUBSCRIPTION_REQUIRED: 402,
  LIMIT_REACHED: 409,
  EMAIL_NOT_VERIFIED: 403,
  INVALID_CASES: 422,
  NO_CASES: 409,
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

/** Runs `handler` for a staff member holding the permission; 401 without a session, 403 otherwise. */
export async function withStaff(
  permission: AdminPermission,
  handler: (user: UserDto) => Promise<Response>,
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHORIZED");
  if (!isStaff(user.role) || !can(user.role, permission)) return apiError("FORBIDDEN");
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

/**
 * Like `withUser`, for actions that create or change tracked data: when e-mail
 * verification is switched on, the address must be confirmed first.
 */
export async function withVerifiedUser(handler: (user: UserDto) => Promise<Response>): Promise<Response> {
  return withUser(async (user) => {
    if (getEnv().EMAIL_VERIFICATION_REQUIRED && !user.emailVerified) return apiError("EMAIL_NOT_VERIFIED");
    return handler(user);
  });
}
