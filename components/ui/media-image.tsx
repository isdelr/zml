"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState, type ReactNode } from "react";

function isSignedMediaUrl(src: ImageProps["src"]): boolean {
  if (typeof src !== "string") {
    return false;
  }

  try {
    const url = new URL(src, "http://localhost");
    return (
      url.searchParams.has("mediaToken") || url.searchParams.has("X-Amz-Signature")
    );
  } catch {
    return false;
  }
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
  ...props
}: MediaImageProps) {
  const [hasErrored, setHasErrored] = useState(false);

  useEffect(() => {
    setHasErrored(false);
  }, [src, fallbackSrc]);

  if ((!src || (hasErrored && !fallbackSrc)) && renderFallback) {
    return <>{renderFallback()}</>;
  }

  const effectiveSrc = hasErrored && fallbackSrc ? fallbackSrc : src;

  if (!effectiveSrc) {
    return null;
  }

  return (
    <Image
      {...props}
      src={effectiveSrc}
      unoptimized={unoptimized ?? isSignedMediaUrl(effectiveSrc)}
      onError={(event) => {
        onError?.(event);

        if (!hasErrored) {
          setHasErrored(true);
        }
      }}
    />
  );
}
