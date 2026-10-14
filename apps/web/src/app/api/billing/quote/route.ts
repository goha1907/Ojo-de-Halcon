import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({ addSeats: z.number().int().min(0).max(50) });

/** Price of buying `addSeats` slots (shown before the user pays). */
export async function POST(request: Request) {
  return withVerifiedUser(async (user) => {
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const result = await getCore().billing.quote(user.id, body.data.addSeats);
    if (!result.ok) return apiError(result.reason);
    return NextResponse.json({ ok: true, quote: result.quote });
  });
}
