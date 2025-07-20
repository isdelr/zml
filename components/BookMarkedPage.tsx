"use client";

import { Bookmark, Play, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";
import { Song } from "@/types";
// Mock data for bookmarked songs, updated to use the Song type
// NOTE: These need to be replaced with real data from Convex.
const bookmarkedSongs: (Song & {
  roundTitle: string;
  leagueName: string;
  leagueId: string;
})[] = [
  {
    _id: "bm1",
    songTitle: "Kiss It Better",
    artist: "Rihanna",
    roundTitle: "Guilty Pleasures",
    leagueName: "80s Pop Throwback",
    leagueId: "2",
    albumArtUrl:
      "https://i.ytimg.com/vi/J7tp_0lFI0I/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDnX9OH1KITaxV876Nn-gONVGbK_w",
    songFileUrl:
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", // Placeholder
  },
  {
    _id: "bm2",
    songTitle: "Be Alright",
    artist: "Dean Lewis",
    roundTitle: "Guilty Pleasures",
    leagueName: "80s Pop Throwback",
    leagueId: "2",
    albumArtUrl:
      "https://sp.universal-music.co.jp/moricalliope/sinderella/common/images/main01_sp.png",
    songFileUrl:
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", // Placeholder
  },
  {
    _id: "bm3",
    songTitle: "Interstellar Main Theme",
    artist: "Hans Zimmer",
    roundTitle: "Movie Scores",
    leagueName: "Cinema Sonics",
    leagueId: "4",
    albumArtUrl:
      "https://sp.universal-music.co.jp/moricalliope/sinderella/common/images/main01_sp.png",
    songFileUrl:
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", // Placeholder
  },
];

export function BookmarkedPage() {
  const { actions: playerActions, currentTrackIndex } = useMusicPlayerStore();

  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto bg-background text-foreground",
        currentTrackIndex !== null && "pb-24",
      )}
    >
      {/* Header */}
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-4xl font-bold">Bookmarked Songs</h1>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search in your bookmarks..."
            className="h-10 w-full rounded-md border-none bg-secondary pl-10 pr-4 text-sm"
          />
        </div>
      </header>

      {/* Bookmarked Songs List */}
      <div className="overflow-hidden rounded-md border">
        {/* Table Header */}
        <div className="grid grid-cols-[auto_4fr_3fr_3fr_auto] items-center gap-4 border-b bg-secondary/50 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
          <span className="w-4 text-center">#</span>
          <span>Track</span>
          <span>From Round</span>
          <span>In League</span>
          <span className="w-32"></span>
        </div>
        {/* Table Body */}
        <div>
          {bookmarkedSongs.map((song, index) => (
            <div
              key={song._id}
              className="group grid grid-cols-[auto_4fr_3fr_3fr_auto] items-center gap-4 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-accent"
            >
              <span className="w-4 text-center text-muted-foreground">
                {index + 1}
              </span>
              <div className="flex items-center gap-4">
                <Image
                  src={song.albumArtUrl}
                  alt={song.songTitle}
                  width={40}
                  height={40}
                  className="aspect-square rounded object-cover"
                />
                <div>
                  <p className="font-semibold text-foreground">
                    {song.songTitle}
                  </p>
                  <p className="text-sm text-muted-foreground">{song.artist}</p>
                </div>
              </div>
              <div>
                <p className="font-medium">{song.roundTitle}</p>
              </div>
              <div>
                <Link
                  href={`/leagues/${song.leagueId}`}
                  className="hover:underline"
                >
                  {song.leagueName}
                </Link>
              </div>
              <div className="flex w-32 justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => playerActions.playSong(song)}
                >
                  <Play className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Bookmark className="size-4 fill-yellow-400 text-yellow-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
