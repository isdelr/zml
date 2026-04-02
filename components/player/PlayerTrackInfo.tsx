"use client";
import { memo } from "react";
import { Song } from "@/types";
import { buildTrackMetadataText } from "@/lib/music/submission-display";
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
import { MediaImage } from "@/components/ui/media-image";

interface PlayerTrackInfoProps {
  currentTrack: Song;
  isBookmarked: boolean;
  onBookmarkToggle: () => void;
  onQueueOpen: () => void;
  onToggleContextView: () => void;
  isContextViewOpen: boolean;
}

export const PlayerTrackInfo = memo(function PlayerTrackInfo({
  currentTrack,
  isBookmarked,
  onBookmarkToggle,
  onQueueOpen,
  onToggleContextView,
  isContextViewOpen,
}: PlayerTrackInfoProps) {
  const src = currentTrack.albumArtUrl;
  const metadataText = buildTrackMetadataText(
    currentTrack.artist,
    currentTrack.albumName,
    currentTrack.year,
  );

  return (
    <div className="flex w-full min-w-0 items-center gap-3 md:w-1/4">
      {src ? (
        <MediaImage
          src={src}
          alt={currentTrack.songTitle}
          width={48}
          height={48}
          className="flex-shrink-0 rounded-md"
          fallbackSrc="/icons/web-app-manifest-192x192.png"
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
});
