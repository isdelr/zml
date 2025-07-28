"use client";

import { useMemo, useState } from "react";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { dynamicImport } from "./ui/dynamic-import";
import { Song } from "@/types";

const BookmarkHeader = dynamicImport(() => import("@/components/bookmarks/BookmarkHeader").then(mod => ({ default: mod.BookmarkHeader })));
const BookmarkList = dynamicImport(() => import("@/components/bookmarks/BookmarkList").then(mod => ({ default: mod.BookmarkList })));

interface BookmarkedPageProps {
  preloadedBookmarkedSongs: Preloaded<typeof api.bookmarks.getBookmarkedSongs>;
}

export function BookmarkedPage({ preloadedBookmarkedSongs }: BookmarkedPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { actions: playerActions } = useMusicPlayerStore();
  const bookmarkedSongs = usePreloadedQuery(preloadedBookmarkedSongs);

  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark)
    .withOptimisticUpdate((localStore, { submissionId }) => {
      // Optimistically remove the song from the bookmarked list
      const currentBookmarked = localStore.getQuery(api.bookmarks.getBookmarkedSongs, {});
      if (currentBookmarked) {
        const newBookmarked = currentBookmarked.filter((s) => s._id !== submissionId);
        localStore.setQuery(api.bookmarks.getBookmarkedSongs, {}, newBookmarked);
      }

      // Also optimistically update the isBookmarked flag in any cached round views
      const roundQueries = localStore.getQuery(api.submissions.getForRound);
      if (roundQueries) {
        for (const [queryArgs, submissions] of roundQueries.entries()) {
          if (submissions?.some((s) => s._id === submissionId)) {
            const newSubmissions = submissions.map((s) =>
              s._id === submissionId ? { ...s, isBookmarked: false } : s
            );
            localStore.setQuery(api.submissions.getForRound, queryArgs, newSubmissions);
          }
        }
      }
    });


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
    // The UI updates instantly. We just show a toast on failure.
    toggleBookmark({ submissionId }).catch((err) => {
      toast.error(err.data?.message || "Failed to remove bookmark.");
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background p-4 text-foreground md:p-8">
      <BookmarkHeader
        searchTerm={searchTerm}
        onSearchChange={(value) => setSearchTerm(value)}
      />

      <BookmarkList
        bookmarkedSongs={filteredSongs as Song[]}
        onBookmarkToggle={handleUnbookmark}
        onPlaySong={playerActions.playSong}
      />
    </div>
  );
}