import { NextResponse } from "next/server";
import { apiError, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

/** The customer closed the payment window without paying. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withVerifiedUser(async (user) => {
    const intent = await getCore().payments.cancel(user.id, id);
    return intent ? NextResponse.json({ ok: true, intent }) : apiError("NOT_FOUND");
  });
}
