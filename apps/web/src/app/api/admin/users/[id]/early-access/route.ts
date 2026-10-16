import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withStaff } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({ enabled: z.boolean() });

/** Turns early access (services not open to everyone yet) on or off for an account. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return withStaff("users.manage", async (staff) => {
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const result = await getCore().admin.setEarlyAccess({ id: staff.id, email: staff.email }, id, body.data.enabled);
    return result.ok ? NextResponse.json({ ok: true }) : apiError("NOT_FOUND");
  });
}
