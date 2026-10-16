import { APP_CONFIG, correoReferenceSchema, holderBirthDateSchema, ocasaNumberSchema, tramiteNumberSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, limitByUser, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.enum(["DNM_DNI", "DNM_CITIZENSHIP", "RENAPER"]),
    number: tramiteNumberSchema,
    birthDate: holderBirthDateSchema.optional(),
  }),
  z.object({ kind: z.literal("CORREO"), number: correoReferenceSchema }),
  z.object({ kind: z.literal("OCASA"), number: ocasaNumberSchema }),
]);

/**
 * Step one of adding a trámite: reads the source and shows what identifies the case (and whether
 * it is already closed). The stages stay hidden until the user confirms.
 */
export async function POST(request: Request) {
  return withVerifiedUser(async (user) => {
    const limited = limitByUser(user.id, "tracker-add", APP_CONFIG.rateLimit.trackerAdd);
    if (limited) return limited;
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const { kind, number } = body.data;
    const birthDate = "birthDate" in body.data ? (body.data.birthDate ?? null) : null;
    const result = await getCore().trackers.previewTramite(user.id, kind, number, birthDate);
    if (!result.ok) return apiError(result.reason);
    return NextResponse.json({ ok: true, header: result.header });
  });
}
