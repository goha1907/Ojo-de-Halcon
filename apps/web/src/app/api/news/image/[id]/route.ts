import { getCore } from "@/server/core";

/** Public: an uploaded news cover. The address changes with every upload, so browsers may keep it for good. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const image = await getCore().admin.newsImage(id);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: { "Content-Type": image.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
