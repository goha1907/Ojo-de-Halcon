import { APP_CONFIG } from "@ojo/shared";
import { NextResponse, type NextRequest } from "next/server";
import { getCore } from "@/server/core";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(APP_CONFIG.cookies.session)?.value;
  await getCore().sessions.destroy(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(APP_CONFIG.cookies.session);
  return response;
}
