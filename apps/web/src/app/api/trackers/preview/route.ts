import { APP_CONFIG, correoReferenceSchema, holderBirthDateSchema, ocasaNumberSchema, tramiteNumberSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, limitByUser, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";
import { isProbing, recordLookup } from "@/server/probe-guard";

const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.enum(["DNM_DNI", "DNM_CITIZENSHIP", "RENAPER"]),
    number: tramiteNumberSchema,
    birthDate: holderBirthDateSchema.optional(),
  }),
  z.object({ kind: z.literal("CORREO"), number: correoReferenceSchema }),
  z.object({ kind: z.literal("OCASA"), number: ocasaNumberSchema }),
]);

/** Answers that mean the source was not asked about this number, so the lookup is not counted. */
const NOT_A_LOOKUP = new Set(["NOT_AVAILABLE", "ALREADY_EXISTS", "BIRTH_DATE_REQUIRED", "SOURCE_DOWN"]);

/**
 * Step one of adding a trámite: reads the source and shows what identifies the case (and whether
 * it is already closed). The stages stay hidden until the user confirms. Lookups that are never
 * followed by adding the case are counted (see probe-guard).
 */
export async function POST(request: Request) {
  return withVerifiedUser(async (user) => {
    const limited = limitByUser(user.id, "tracker-add", APP_CONFIG.rateLimit.trackerAdd);
    if (limited) return limited;
    if (isProbing(user.id)) return apiError("PROBING");
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const { kind, number } = body.data;
    const birthDate = "birthDate" in body.data ? (body.data.birthDate ?? null) : null;
    const result = await getCore().trackers.previewTramite(user.id, kind, number, birthDate);
    if (!result.ok) {
      if (NOT_A_LOOKUP.has(result.reason)) return apiError(result.reason);
      return apiError(result.reason, recordLookup(user.id, `${kind}:${number}`));
    }
    return NextResponse.json({ ok: true, header: result.header, ...recordLookup(user.id, `${kind}:${number}`) });
  });
}
