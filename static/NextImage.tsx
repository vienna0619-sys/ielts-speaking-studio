import type { CSSProperties, ImgHTMLAttributes } from "react";

/* eslint-disable @next/next/no-img-element */

interface StaticImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> {
  src: string | { src: string };
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  width?: number;
  height?: number;
}

export default function StaticImage({
  src,
  alt = "",
  fill,
  priority,
  style,
  ...props
}: StaticImageProps) {
  const rawSource = typeof src === "string" ? src : src.src;
  const resolvedSource = rawSource.startsWith("/")
    ? `${import.meta.env.BASE_URL}${rawSource.slice(1)}`
    : rawSource;
  const fillStyle: CSSProperties | undefined = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style }
    : style;

  return (
    <img
      {...props}
      alt={alt}
      src={resolvedSource}
      style={fillStyle}
      fetchPriority={priority ? "high" : undefined}
    />
  );
}
