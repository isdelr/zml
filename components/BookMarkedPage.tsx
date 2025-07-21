"use client";

import { useMemo, useState } from "react";
import { Bookmark, Play, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";
import { Song } from "@/types";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Skeleton } from "./ui/skeleton";
// --- ADDED ---
import { FaSpotify, FaYoutube } from "react-icons/fa";
// --- END ADDED ---

export function BookmarkedPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { actions: playerActions, currentTrackIndex } = useMusicPlayerStore();
  const bookmarkedSongs = useQuery(api.bookmarks.getBookmarkedSongs);
  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);

  const filteredSongs = useMemo(() => {
    if (!bookmarkedSongs) return [];
    if (!searchTerm) return bookmarkedSongs;

    return bookmarkedSongs.filter(
      (song) =>
        song.songTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
        song.roundTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        song.leagueName.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [bookmarkedSongs, searchTerm]);

  const handleUnbookmark = (submissionId: Id<"submissions">) => {
    toast.promise(toggleBookmark({ submissionId }), {
      loading: "Removing bookmark...",
      success: "Bookmark removed.",
      error: (err) => err.data?.message || "Failed to remove bookmark.",
    });
  };

  const BookmarksSkeleton = () => (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-[auto_4fr_3fr_3fr_auto] items-center gap-4 border-b bg-secondary/50 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span className="w-4 text-center">#</span>
        <span>Track</span>
        <span>From Round</span>
        <span>In League</span>
        <span className="w-32"></span>
      </div>
      <div>
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[auto_4fr_3fr_3fr_auto] items-center gap-4 border-b px-4 py-3"
          >
            <Skeleton className="h-5 w-4" />
            <div className="flex items-center gap-4">
              <Skeleton className="size-10 rounded" />
              <div className="w-full space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-2/3" />
            <div className="w-32"></div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto bg-background p-8 text-foreground",
        currentTrackIndex !== null && "pb-24",
      )}
    >
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-4xl font-bold">Bookmarked Songs</h1>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search in your bookmarks..."
            className="h-10 w-full rounded-md border-none bg-secondary pl-10 pr-4 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      {bookmarkedSongs === undefined && <BookmarksSkeleton />}

      {bookmarkedSongs && filteredSongs.length === 0 && (
        <div className="rounded-lg border border-dashed py-20 text-center">
          <h2 className="text-xl font-semibold">
            {searchTerm ? "No Songs Found" : "No Bookmarked Songs"}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {searchTerm
              ? "Try a different search term."
              : "Click the bookmark icon on a song to save it here."}
          </p>
        </div>
      )}

      {bookmarkedSongs && filteredSongs.length > 0 && (
        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-[auto_4fr_3fr_3fr_auto] items-center gap-4 border-b bg-secondary/50 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
            <span className="w-4 text-center">#</span>
            <span>Track</span>
            <span>From Round</span>
            <span>In League</span>
            <span className="w-32"></span>
          </div>
          <div>
            {filteredSongs.map((song, index) => (
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
                    <p className="text-sm text-muted-foreground">
                      {song.artist}
                    </p>
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
                  {/* --- Start of Change --- */}
                  {song.submissionType === 'file' ? (
                     <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => playerActions.playSong(song as Song)}
                      >
                        <Play className="size-4" />
                      </Button>
                  ) : (
                    <a href={song.songLink!} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="opacity-0 transition-opacity group-hover:opacity-100">
                        {song.submissionType === 'spotify' && <FaSpotify className="size-4 text-green-500" />}
                        {song.submissionType === 'youtube' && <FaYoutube className="size-4 text-red-500" />}
                      </Button>
                    </a>
                  )}
                  {/* --- End of Change --- */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() =>
                      handleUnbookmark(song._id as Id<"submissions">)
                    }
                  >
                    <Bookmark className="size=5 fill-primary text-primary" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}