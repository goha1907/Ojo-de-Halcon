import { holderBirthDateSchema, tramiteNumberSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody, withUser } from "@/server/api";
import { getCore } from "@/server/core";

type Context = { params: Promise<{ id: string }> };

/**
 * Discards a court case that is still waiting for confirmation, or frees the
 * slot of a confirmed case when the replacement rule allows it (30 days).
 */
export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return withUser(async (user) => {
    const trackers = getCore().trackers;
    const ok = (await trackers.discardPending(user.id, id)) || (await trackers.releaseCase(user.id, id));
    return ok ? NextResponse.json({ ok: true }) : apiError("FORBIDDEN");
  });
}

const correctSchema = z.object({ number: tramiteNumberSchema, birthDate: holderBirthDateSchema.optional() });

/** Replaces the number of a RENAPER/Correo slot (typo, re-issued number, or cooldown over). */
export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return withUser(async (user) => {
    const body = await parseBody(request, correctSchema);
    if (!body.ok) return body.response;
    const result = await getCore().trackers.replaceNumber(user.id, id, body.data.number, body.data.birthDate ?? null);
    if (result === "ALREADY_EXISTS") return apiError("ALREADY_EXISTS");
    if (result === "NOT_ALLOWED") return apiError("FORBIDDEN");
    return NextResponse.json({ ok: true });
  });
}
