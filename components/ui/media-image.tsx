"use client";

import Image, { type ImageProps } from "next/image";
import { useMemo, useState, type ReactNode } from "react";

function isSignedMediaUrl(src: ImageProps["src"]): boolean {
  if (typeof src !== "string") {
    return false;
  }

  try {
    const url = new URL(src, "http://localhost");
    return (
      url.pathname.startsWith("/api/media/") ||
      url.searchParams.has("mediaToken") || url.searchParams.has("X-Amz-Signature")
    );
  } catch {
    return false;
  }
}

function getMediaSourceKey(src: ImageProps["src"] | undefined): string {
  if (!src) {
    return "";
  }

  if (typeof src === "string") {
    return src;
  }

  if (typeof src === "object" && "src" in src && typeof src.src === "string") {
    return src.src;
  }

  return "";
}

type MediaImageProps = Omit<ImageProps, "onError"> & {
  fallbackSrc?: ImageProps["src"];
  onError?: ImageProps["onError"];
  renderFallback?: () => ReactNode;
};

export function MediaImage({
  src,
  fallbackSrc,
  renderFallback,
  unoptimized,
  onError,
  alt,
  ...props
}: MediaImageProps) {
  const [erroredSourceKey, setErroredSourceKey] = useState<string | null>(null);
  const sourceKey = useMemo(
    () => `${getMediaSourceKey(src)}::${getMediaSourceKey(fallbackSrc)}`,
    [fallbackSrc, src],
  );
  const hasErrored = erroredSourceKey === sourceKey;

  if ((!src || (hasErrored && !fallbackSrc)) && renderFallback) {
    return <>{renderFallback()}</>;
  }

  const effectiveSrc = hasErrored && fallbackSrc ? fallbackSrc : src;

  if (!effectiveSrc) {
    return null;
  }

  const resolvedSrc = effectiveSrc;

  return (
    <Image
      {...props}
      alt={alt}
      src={resolvedSrc}
      unoptimized={unoptimized ?? isSignedMediaUrl(resolvedSrc)}
      onError={(event) => {
        onError?.(event);

        if (!hasErrored) {
          setErroredSourceKey(sourceKey);
        }
      }}
    />
  );
}
