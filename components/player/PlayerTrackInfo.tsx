"use client";
import Image from "next/image";

interface PlayerTrackInfoProps {
  currentTrack: unknown;
  isBookmarked: boolean;
  onBookmarkToggle: () => void;
}

export function PlayerTrackInfo({
  currentTrack,
}: PlayerTrackInfoProps) {
  if (!currentTrack) return null;
  
  return (
    <div className="flex w-full min-w-0 items-center gap-3 md:w-1/4">
      <Image
        src={currentTrack.albumArtUrl}
        alt={currentTrack.songTitle}
        width={48}
        height={48}
        className="flex-shrink-0 rounded-md"
      />
      <div className="truncate">
        <p className="truncate text-sm font-semibold">
          {currentTrack.songTitle}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {currentTrack.artist}
        </p>
      </div>
    </div>
  );
}