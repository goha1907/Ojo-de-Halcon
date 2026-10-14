import { NextResponse } from "next/server";
import { apiError, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";
import { getEnv } from "@/server/env";

/** Stub of an early renewal (one more period). Disabled when PAYMENTS_STUB is off. */
export async function POST() {
  return withVerifiedUser(async (user) => {
    if (!getEnv().PAYMENTS_STUB) return apiError("FORBIDDEN");
    const quote = await getCore().billing.renew(user.id);
    return NextResponse.json({ ok: true, quote });
  });
}
