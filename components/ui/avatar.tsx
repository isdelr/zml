"use client"


import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

function buildDiscordDefaultAvatarUrl(src: string): string | null {
  try {
    const url = new URL(src)
    const isDiscordHost =
      url.hostname === "cdn.discordapp.com" ||
      url.hostname === "media.discordapp.net"
    if (!isDiscordHost) {
      return null
    }

    const match = /^\/avatars\/(\d+)\/[^/]+$/u.exec(url.pathname)
    if (!match) {
      return null
    }

    const userId = match[1]
    const fallbackIndex = Number((BigInt(userId) >> BigInt(22)) % BigInt(6))
    return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`
  } catch {
    return null
  }
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
  const [resolvedSrc, setResolvedSrc] = React.useState(src)
  const hasRetriedRef = React.useRef(false)

  React.useEffect(() => {
    setResolvedSrc(src)
    hasRetriedRef.current = false
  }, [src])

  const handleError: React.ComponentProps<typeof AvatarPrimitive.Image>["onError"] =
    (event) => {
      if (!hasRetriedRef.current && typeof resolvedSrc === "string") {
        const discordFallback = buildDiscordDefaultAvatarUrl(resolvedSrc)
        if (discordFallback && discordFallback !== resolvedSrc) {
          hasRetriedRef.current = true
          setResolvedSrc(discordFallback)
          return
        }
      }

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
