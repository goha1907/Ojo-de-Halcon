import { NextResponse } from "next/server";
import { withUser } from "@/server/api";
import { getCore } from "@/server/core";

export async function DELETE() {
  return withUser(async (user) => {
    await getCore().telegram.unlink(user.id);
    return NextResponse.json({ ok: true });
  });
}
