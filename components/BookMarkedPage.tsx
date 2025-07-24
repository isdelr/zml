"use client";

import { useMemo, useState } from "react";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { dynamicImport } from "./ui/dynamic-import";

 
const BookmarkHeader = dynamicImport(() => import("./bookmarks/BookmarkHeader").then(mod => ({ default: mod.BookmarkHeader })));
const BookmarkList = dynamicImport(() => import("./bookmarks/BookmarkList").then(mod => ({ default: mod.BookmarkList })));

export function BookmarkedPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { actions: playerActions } = useMusicPlayerStore();
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

  return (
<div className="flex-1 overflow-y-auto bg-background p-4 text-foreground md:p-8">
      <BookmarkHeader 
        searchTerm={searchTerm}
        onSearchChange={(value) => setSearchTerm(value)}
      />

      <BookmarkList 
        bookmarkedSongs={filteredSongs}
        onBookmarkToggle={handleUnbookmark}
        onPlaySong={playerActions.playSong}
      />
    </div>
  );
}