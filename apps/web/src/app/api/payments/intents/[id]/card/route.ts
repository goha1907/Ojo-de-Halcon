import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

/** Only the provider's token: a card number never comes to this server. */
const bodySchema = z.object({ token: z.string().min(1).max(200) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withVerifiedUser(async (user) => {
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const intent = await getCore().payments.submitCard(user.id, id, body.data.token);
    return intent ? NextResponse.json({ ok: true, intent }) : apiError("NOT_FOUND");
  });
}
