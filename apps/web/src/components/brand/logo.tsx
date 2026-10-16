import Image from "next/image";
import { logoAsset, type LogoTone, type LogoVariant } from "@/lib/brand";

/**
 * Brand logo. By default it follows the theme: graphite artwork on light, white on dark
 * (both are rendered, CSS shows one, so nothing flashes or shifts). Pass `tone` to pin the
 * artwork to a surface that never changes theme. Width and height are fixed up front.
 */
export function Logo({
  variant = "horizontal",
  tone,
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
  // SVG artwork needs no resizing pipeline, so it is served as-is
  const image = (t: LogoTone, imgClass?: string) => (
    <Image {...logoAsset(variant, t, height)} alt={alt} className={imgClass} priority={priority} unoptimized />
  );
  if (tone) return <span className={className}>{image(tone, "block")}</span>;
  return (
    <span className={className}>
      {image("light", "block dark:hidden")}
      {image("dark", "hidden dark:block")}
    </span>
  );
}
