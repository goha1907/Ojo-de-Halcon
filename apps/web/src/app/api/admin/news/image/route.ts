import { NEWS_IMAGE_MAX_BYTES, NEWS_IMAGE_SIZE } from "@ojo/shared";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { apiError, withStaff } from "@/server/api";
import { getCore } from "@/server/core";

/** Pictures the admin area accepts. SVG is left out on purpose: it can carry scripts. */
const ACCEPTED = new Set(["jpeg", "png", "webp", "gif", "avif"]);
const MAX_INPUT_PIXELS = 40_000_000;

/**
 * Uploads a news cover. Whatever comes in is checked to be a real raster picture, turned upright, cropped to the
 * card ratio and saved as a compressed WebP, so every cover looks alike and weighs little.
 */
export async function POST(request: Request) {
  return withStaff("news.manage", async (staff) => {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) return apiError("BAD_REQUEST", { reason: "NO_FILE" });
    if (file.size > NEWS_IMAGE_MAX_BYTES) return apiError("BAD_REQUEST", { reason: "TOO_BIG" });
    try {
      const source = Buffer.from(await file.arrayBuffer());
      const meta = await sharp(source, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
      if (!meta.format || !ACCEPTED.has(meta.format)) return apiError("BAD_REQUEST", { reason: "NOT_A_PICTURE" });
      const data = await sharp(source, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize(NEWS_IMAGE_SIZE.width, NEWS_IMAGE_SIZE.height, { fit: "cover", position: "attention" })
        .webp({ quality: 82 })
        .toBuffer();
      const url = await getCore().admin.saveNewsImage({ id: staff.id, email: staff.email }, { mime: "image/webp", data });
      return NextResponse.json({ url });
    } catch {
      return apiError("BAD_REQUEST", { reason: "NOT_A_PICTURE" });
    }
  });
}
