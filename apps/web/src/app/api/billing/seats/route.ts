import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({
  seats: z.number().int().min(0),
  removePersonIds: z.array(z.string().min(1)).max(10),
});

/** Lowers the number of slots; the owner names the relatives who are removed. */
export async function PUT(request: Request) {
  return withVerifiedUser(async (user) => {
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const result = await getCore().billing.reduceSeats(user.id, body.data);
    if (!result.ok) return apiError(result.reason);
    return NextResponse.json({ ok: true, seats: result.seats });
  });
}
