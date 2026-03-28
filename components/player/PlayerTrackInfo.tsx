"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/lib/convex/api";
import { Song } from "@/types";
import { buildTrackMetadataText } from "@/lib/music/submission-display";
import { parsePresignedUrlExpiry } from "@/lib/music/presigned-url";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OverflowText } from "@/components/ui/overflow-text";
import { Bookmark, EllipsisVertical, List, PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerTrackInfoProps {
  currentTrack: Song;
  isBookmarked: boolean;
  onBookmarkToggle: () => void;
  onQueueOpen: () => void;
  onToggleContextView: () => void;
  isContextViewOpen: boolean;
}

export function PlayerTrackInfo({
  currentTrack,
  isBookmarked,
  onBookmarkToggle,
  onQueueOpen,
  onToggleContextView,
  isContextViewOpen,
}: PlayerTrackInfoProps) {
  const getPresignedAlbumArtUrl = useAction(
    api.submissions.getPresignedAlbumArtUrl
  );

  const [effectiveUrl, setEffectiveUrl] = useState<string | null>(
    currentTrack?.albumArtUrl ?? null
  );
  const refreshTimeoutRef = useRef<number | null>(null);

  const scheduleRefresh = (url?: string | null) => {
    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    if (!currentTrack || currentTrack.submissionType !== "file") return;
    const expiry = parsePresignedUrlExpiry(url);
    const SAFETY_MS = 60_000;
    let delay: number;
    if (expiry) {
      delay = Math.max(0, expiry - SAFETY_MS - Date.now());
    } else {
      // Fallback periodic refresh every 30 minutes for file submissions
      delay = 30 * 60 * 1000;
    }
    refreshTimeoutRef.current = window.setTimeout(async () => {
      try {
        const newUrl = await getPresignedAlbumArtUrl({
          submissionId: currentTrack._id,
        });
        if (newUrl) {
          // Prefetch to avoid flicker
          const img = new window.Image();
          img.onload = () => {
            setEffectiveUrl(newUrl);
            scheduleRefresh(newUrl);
          };
          img.src = newUrl;
        } else {
          // stop scheduling if cannot refresh
        }
      } catch {
        // silent
      }
    }, delay);
  };

  useEffect(() => {
    setEffectiveUrl(currentTrack?.albumArtUrl ?? null);
    scheduleRefresh(currentTrack?.albumArtUrl ?? null);
    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?._id]);

  if (!currentTrack) return null;

  const src = effectiveUrl ?? currentTrack.albumArtUrl;
  const metadataText = buildTrackMetadataText(
    currentTrack.artist,
    currentTrack.albumName,
    currentTrack.year,
  );

  return (
    <div className="flex w-full min-w-0 items-center gap-3 md:w-1/4">
      {src ? (
        <Image
          src={src}
          alt={currentTrack.songTitle}
          width={48}
          height={48}
          className="flex-shrink-0 rounded-md"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <OverflowText
          marquee
          className="text-sm font-semibold leading-tight"
          textClassName="pr-2"
        >
          {currentTrack.songTitle}
        </OverflowText>
        <OverflowText
          marquee
          className="mt-0.5 text-xs leading-tight text-muted-foreground"
          textClassName="pr-2"
        >
          {metadataText}
        </OverflowText>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 md:hidden"
            title="Player options"
          >
            <EllipsisVertical className="size-4" />
            <span className="sr-only">Open player options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 md:hidden">
          <DropdownMenuItem onClick={onToggleContextView}>
            <PanelRight
              className={cn("size-4", isContextViewOpen && "text-primary")}
            />
            <span>
              {isContextViewOpen
                ? "Hide now playing view"
                : "Show now playing view"}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onBookmarkToggle}>
            <Bookmark
              className={cn(
                "size-4",
                isBookmarked && "fill-primary text-primary",
              )}
            />
            <span>{isBookmarked ? "Remove bookmark" : "Bookmark song"}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onQueueOpen}>
            <List className="size-4" />
            <span>Open queue</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
