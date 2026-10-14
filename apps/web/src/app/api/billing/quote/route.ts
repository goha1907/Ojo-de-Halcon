import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({ cases: z.number().int().min(1) });

/** Price of holding `cases` cases in total (shown before the user pays). */
export async function POST(request: Request) {
  return withVerifiedUser(async (user) => {
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const result = await getCore().billing.quote(user.id, body.data.cases);
    if (!result.ok) return apiError(result.reason === "LIMIT_REACHED" ? "LIMIT_REACHED" : "INVALID_CASES");
    return NextResponse.json({ ok: true, quote: result.quote });
  });
}
