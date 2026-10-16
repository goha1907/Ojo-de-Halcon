import Image from "next/image";
import { logoAsset, type LogoTone, type LogoVariant } from "@/lib/brand";

/**
 * Brand logo. `tone` is the background it sits on: the light-background artwork is graphite,
 * the dark-background artwork is white. Width and height are fixed up front, so nothing shifts.
 */
export function Logo({
  variant = "horizontal",
  tone = "light",
  height = 36,
  alt,
  className,
  priority = false,
}: {
  variant?: LogoVariant;
  tone?: LogoTone;
  height?: number;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const asset = logoAsset(variant, tone, height);
  // SVG artwork needs no resizing pipeline, so it is served as-is
  return <Image {...asset} alt={alt} className={className} priority={priority} unoptimized />;
}
