import { NextResponse } from "next/server";
import { apiError, withStaff } from "@/server/api";
import { getCore } from "@/server/core";

/** Deletes a news entry written in the admin area (all languages); entries kept in files are not touched. */
export async function DELETE(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  return withStaff("news.manage", async (staff) => {
    const result = await getCore().admin.deleteNews({ id: staff.id, email: staff.email }, slug);
    if (!result.ok) return apiError(result.reason === "NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST");
    return NextResponse.json({ ok: true });
  });
}
