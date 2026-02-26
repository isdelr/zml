"use client"


import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

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
  const [resolvedSrc, setResolvedSrc] = React.useState(sanitizeAvatarSrc(src))

  React.useEffect(() => {
    setResolvedSrc(sanitizeAvatarSrc(src))
  }, [src])

  const handleError: React.ComponentProps<typeof AvatarPrimitive.Image>["onError"] =
    (event) => {
      onError?.(event)
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
