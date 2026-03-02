"use client"


import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const stablePresignedAvatarUrls = new Map<string, string>()
const MAX_STABLE_AVATAR_URLS = 500

function rememberStableAvatarSrc(cacheKey: string, src: string) {
  if (!stablePresignedAvatarUrls.has(cacheKey) && stablePresignedAvatarUrls.size >= MAX_STABLE_AVATAR_URLS) {
    const oldestCacheKey = stablePresignedAvatarUrls.keys().next().value
    if (oldestCacheKey !== undefined) {
      stablePresignedAvatarUrls.delete(oldestCacheKey)
    }
  }
  stablePresignedAvatarUrls.set(cacheKey, src)
}

function getPresignedAvatarCacheKey(src: string): string | null {
  try {
    const url = new URL(src)
    if (!url.searchParams.has("X-Amz-Signature")) {
      return null
    }

    const avatarPath = /\/avatars\/[^/?#]+$/u.exec(url.pathname)?.[0]
    if (!avatarPath) {
      return null
    }

    return `${url.origin}${avatarPath}`
  } catch {
    return null
  }
}

function sanitizeAvatarSrc(
  src: React.ComponentProps<typeof AvatarPrimitive.Image>["src"],
): React.ComponentProps<typeof AvatarPrimitive.Image>["src"] {
  if (!src) {
    return src
  }

  if (typeof src !== "string") {
    return src
  }

  try {
    const url = new URL(src)
    if (
      url.hostname === "cdn.discordapp.com" ||
      url.hostname === "media.discordapp.net"
    ) {
      return undefined
    }
  } catch {
    // Keep non-URL values unchanged.
  }

  return src
}

function resolveStableAvatarSrc(
  src: React.ComponentProps<typeof AvatarPrimitive.Image>["src"],
): React.ComponentProps<typeof AvatarPrimitive.Image>["src"] {
  const sanitized = sanitizeAvatarSrc(src)
  if (typeof sanitized !== "string") {
    return sanitized
  }

  const cacheKey = getPresignedAvatarCacheKey(sanitized)
  if (!cacheKey) {
    return sanitized
  }

  const cachedSrc = stablePresignedAvatarUrls.get(cacheKey)
  if (cachedSrc) {
    return cachedSrc
  }

  rememberStableAvatarSrc(cacheKey, sanitized)
  return sanitized
}

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  src,
  onError,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  const [resolvedSrc, setResolvedSrc] = React.useState(() =>
    resolveStableAvatarSrc(src)
  )

  React.useEffect(() => {
    setResolvedSrc(resolveStableAvatarSrc(src))
  }, [src])

  const handleError: React.ComponentProps<typeof AvatarPrimitive.Image>["onError"] =
    (event) => {
      onError?.(event)

      const latestSanitizedSrc = sanitizeAvatarSrc(src)
      if (typeof latestSanitizedSrc !== "string") {
        setResolvedSrc(latestSanitizedSrc)
        return
      }

      const cacheKey = getPresignedAvatarCacheKey(latestSanitizedSrc)
      if (cacheKey) {
        rememberStableAvatarSrc(cacheKey, latestSanitizedSrc)
      }

      setResolvedSrc(latestSanitizedSrc)
    }

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      src={resolvedSrc}
      onError={handleError}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "generated-art bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
