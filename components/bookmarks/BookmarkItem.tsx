"use client";

import { Button } from "@/components/ui/button";
import { Bookmark, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import type { BookmarkedSong } from "@/lib/convex/types";
import { YouTubeIcon } from "@/components/icons/BrandIcons";

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
  return (
    <div
      key={song._id}
      className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b p-3 transition-colors last:border-b-0 hover:bg-accent md:grid-cols-[auto_4fr_3fr_3fr_auto] md:gap-4"
    >
<span className="hidden w-4 text-center text-muted-foreground md:block">
{index + 1}
</span>
      <div className="flex items-center gap-4">
        <Image
          src={song.albumArtUrl ?? "/icons/web-app-manifest-192x192.png"}
          alt={song.songTitle}
          width={40}
          height={40}
          className="aspect-square rounded object-cover"
        />
        <div>
          <p className="font-semibold text-foreground">{song.songTitle}</p>
          <p className="text-sm text-muted-foreground">{song.artist}</p>
        </div>
      </div>
      <div className="hidden text-sm text-muted-foreground md:block md:text-base">
        <p className="font-medium">{song.roundTitle}</p>
      </div>
      <div className="hidden text-sm text-muted-foreground md:block md:text-base">
        <Link href={`/leagues/${song.leagueId}`} className="hover:underline md:text-foreground">
          {song.leagueName}
        </Link>
      </div>
      <div className="flex items-center justify-end md:w-32 md:gap-2">
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

      <div className="-mt-2 col-span-full flex justify-between pl-[56px] text-xs text-muted-foreground md:hidden">
        <span>{song.roundTitle}</span>
        <Link href={`/leagues/${song.leagueId}`} className="hover:underline">
          {song.leagueName}
        </Link>
      </div>
    </div>
  );
}
