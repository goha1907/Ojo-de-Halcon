import { APP_CONFIG, DNM_KINDS, holderBirthDateSchema, tramiteNumberSchema } from "@ojo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, limitByUser, parseBody, withVerifiedUser } from "@/server/api";
import { getCore } from "@/server/core";

const bodySchema = z.object({
  kind: z.enum(DNM_KINDS),
  number: tramiteNumberSchema,
  birthDate: holderBirthDateSchema.optional(),
});

/** Step one of adding a Migraciones case: shows whose case it is; the steps stay hidden. */
export async function POST(request: Request) {
  return withVerifiedUser(async (user) => {
    const limited = limitByUser(user.id, "tracker-add", APP_CONFIG.rateLimit.trackerAdd);
    if (limited) return limited;
    const body = await parseBody(request, bodySchema);
    if (!body.ok) return body.response;
    const { kind, number, birthDate } = body.data;
    const result = await getCore().trackers.previewDnm(user.id, kind, number, birthDate ?? null);
    if (!result.ok) return apiError(result.reason);
    return NextResponse.json({ ok: true, header: result.header });
  });
}
