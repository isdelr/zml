"use client";

import { BookmarkItem } from "./BookmarkItem";
import { Id } from "@/convex/_generated/dataModel";
import type { BookmarkedSong } from "@/lib/convex/types";

interface BookmarkListProps {
  bookmarkedSongs: BookmarkedSong[];
  onBookmarkToggle: (submissionId: Id<"submissions">) => void;
  onPlaySong: (song: BookmarkedSong) => void;
}

export function BookmarkList({ 
  bookmarkedSongs, 
  onBookmarkToggle, 
  onPlaySong 
}: BookmarkListProps) {
  if (bookmarkedSongs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-20 text-center">
        <h2 className="text-xl font-semibold">No Bookmarked Songs</h2>
        <p className="mt-2 text-muted-foreground">
          Click the bookmark icon on a song to save it here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="hidden grid-cols-[auto_4fr_3fr_3fr_auto] items-center gap-4 border-b bg-secondary/50 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground md:grid">
        <span className="w-4 text-center">#</span>
        <span>Track</span>
        <span>From Round</span>
        <span>In League</span>
        <span className="w-32"></span>
      </div>
      <div>
        {bookmarkedSongs.map((song, index) => (
          <BookmarkItem 
            key={song._id}
            song={song}
            index={index}
            onBookmarkToggle={onBookmarkToggle}
            onPlaySong={onPlaySong}
          />
        ))}
      </div>
    </div>
  );
}
