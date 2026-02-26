"use client";
import { useMemo, useState } from "react";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { dynamicImport } from "./ui/dynamic-import";
import type { BookmarkedSong } from "@/lib/convex/types";
import type { Song } from "@/types";
import { toErrorMessage } from "@/lib/errors";

const BookmarkHeader = dynamicImport(() =>
  import("@/components/bookmarks/BookmarkHeader").then((mod) => ({ default: mod.BookmarkHeader })),
);
const BookmarkList = dynamicImport(() =>
  import("@/components/bookmarks/BookmarkList").then((mod) => ({ default: mod.BookmarkList })),
);

export function BookmarkedPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { actions: playerActions } = useMusicPlayerStore();
  const bookmarkedSongs = useQuery(api.bookmarks.getBookmarkedSongs, {});

  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark).withOptimisticUpdate(
    (localStore, { submissionId }) => {
      const currentBookmarked = localStore.getQuery(api.bookmarks.getBookmarkedSongs, {});
      if (currentBookmarked) {
        const newBookmarked = currentBookmarked.filter((s) => s._id !== submissionId);
        localStore.setQuery(api.bookmarks.getBookmarkedSongs, {}, newBookmarked);
      }
      // Also optimistically update isBookmarked in any cached round views
      const roundQueries = localStore.getAllQueries(api.submissions.getForRound);
      for (const { args, value } of roundQueries) {
        if (value?.some((s) => s._id === submissionId)) {
          const newSubmissions = value.map((s) =>
            s._id === submissionId ? { ...s, isBookmarked: false } : s,
          );
          localStore.setQuery(api.submissions.getForRound, args, newSubmissions);
        }
      }
    },
  );

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
    toggleBookmark({ submissionId }).catch((error: unknown) => {
      toast.error(toErrorMessage(error, "Failed to remove bookmark."));
    });
  };
  const handlePlayBookmarkedSong = (song: BookmarkedSong) => {
    const playableSong: Song = {
      ...song,
      albumArtUrl: song.albumArtUrl ?? "/icons/web-app-manifest-192x192.png",
      songFileUrl: song.songFileUrl ?? null,
      songLink: song.songLink ?? null,
    };
    playerActions.playSong(playableSong);
  };

  if (bookmarkedSongs === undefined) {
    return (
      <div className="min-h-full bg-background p-4 text-foreground md:p-8">
        <BookmarkHeader searchTerm={searchTerm} onSearchChange={(value) => setSearchTerm(value)} />
        <div className="rounded-lg border border-dashed py-20 text-center">
          <h2 className="text-xl font-semibold">Loading Bookmarks</h2>
          <p className="mt-2 text-muted-foreground">
            Fetching your saved songs...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background p-4 text-foreground md:p-8">
      <BookmarkHeader searchTerm={searchTerm} onSearchChange={(value) => setSearchTerm(value)} />
      <BookmarkList
        bookmarkedSongs={filteredSongs}
        onBookmarkToggle={handleUnbookmark}
        onPlaySong={handlePlayBookmarkedSong}
      />
    </div>
  );
}
