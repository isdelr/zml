"use client";

import { Button } from "@/components/ui/button";
import { Bookmark, Play } from "lucide-react";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import type { BookmarkedSong } from "@/lib/convex/types";
import { YouTubeIcon } from "@/components/icons/BrandIcons";
import { buildTrackMetadataText } from "@/lib/music/submission-display";
import { MediaImage } from "@/components/ui/media-image";

interface BookmarkItemProps {
  song: BookmarkedSong;
  index: number;
  onBookmarkToggle: (submissionId: Id<"submissions">) => void;
  onPlaySong: (song: BookmarkedSong) => void;
}

export function BookmarkItem({
  song,
  index,
  onBookmarkToggle,
  onPlaySong,
}: BookmarkItemProps) {
  const metadataText = buildTrackMetadataText(
    song.artist,
    song.albumName,
    song.year,
  );

  return (
    <div
      key={song._id}
      className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b p-3 transition-colors last:border-b-0 hover:bg-accent lg:grid-cols-[auto_4fr_3fr_3fr_auto] lg:gap-4"
    >
      <span className="hidden w-4 text-center text-muted-foreground lg:block">
        {index + 1}
      </span>
      <div className="flex items-center gap-4">
        <MediaImage
          src={song.albumArtUrl ?? "/icons/web-app-manifest-192x192.png"}
          alt={song.songTitle}
          width={40}
          height={40}
          className="aspect-square rounded object-cover"
          fallbackSrc="/icons/web-app-manifest-192x192.png"
        />
        <div>
          <p className="font-semibold text-foreground">{song.songTitle}</p>
          <p className="text-sm text-muted-foreground">{metadataText}</p>
        </div>
      </div>
      <div className="hidden text-sm text-muted-foreground lg:block lg:text-base">
        <p className="font-medium">{song.roundTitle}</p>
      </div>
      <div className="hidden text-sm text-muted-foreground lg:block lg:text-base">
        <Link
          href={`/leagues/${song.leagueId}`}
          className="hover:underline lg:text-foreground"
        >
          {song.leagueName}
        </Link>
      </div>
      <div className="flex items-center justify-end lg:w-32 lg:gap-2">
        {song.submissionType === "file" ? (
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => onPlaySong(song)}
          >
            <Play className="size-4" />
          </Button>
        ) : (
          <a href={song.songLink!} target="_blank" rel="noopener noreferrer">
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 transition-opacity group-hover:opacity-100"
            >
              {song.submissionType === "youtube" && (
                <YouTubeIcon className="size-4 text-red-500" />
              )}
            </Button>
          </a>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => onBookmarkToggle(song._id)}
        >
          <Bookmark className="size-5 fill-primary text-primary" />
        </Button>
      </div>

      <div className="-mt-2 col-span-full flex justify-between pl-[56px] text-xs text-muted-foreground lg:hidden">
        <span>{song.roundTitle}</span>
        <Link href={`/leagues/${song.leagueId}`} className="hover:underline">
          {song.leagueName}
        </Link>
      </div>
    </div>
  );
}
