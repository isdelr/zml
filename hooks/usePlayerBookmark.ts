"use client";

import { useState } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { toast } from "sonner";

import { api } from "@/lib/convex/api";
import type { Song } from "@/types";

interface UsePlayerBookmarkArgs {
  currentTrack: Song | null;
}

export function usePlayerBookmark({ currentTrack }: UsePlayerBookmarkArgs) {
  const { isAuthenticated } = useConvexAuth();
  const [bookmarkOverride, setBookmarkOverride] = useState<{
    trackId: string;
    value: boolean;
  } | null>(null);

  const toggleBookmark = useMutation(
    api.bookmarks.toggleBookmark,
  ).withOptimisticUpdate((localStore, { submissionId }) => {
    const roundQueries = localStore.getAllQueries(api.submissions.getForRound);
    for (const { args, value: submissions } of roundQueries) {
      if (!submissions?.some((submission) => submission._id === submissionId)) {
        continue;
      }
      const newSubmissions = submissions.map((submission) =>
        submission._id === submissionId
          ? { ...submission, isBookmarked: !submission.isBookmarked }
          : submission,
      );
      localStore.setQuery(api.submissions.getForRound, args, newSubmissions);
    }

    const currentBookmarked = localStore.getQuery(
      api.bookmarks.getBookmarkedSongs,
      {},
    );
    if (currentBookmarked) {
      const isAlreadyBookmarked = currentBookmarked.some(
        (song) => song._id === submissionId,
      );
      if (isAlreadyBookmarked) {
        const newBookmarked = currentBookmarked.filter(
          (song) => song._id !== submissionId,
        );
        localStore.setQuery(api.bookmarks.getBookmarkedSongs, {}, newBookmarked);
      }
    }
  });

  const isBookmarked =
    currentTrack !== null &&
    bookmarkOverride?.trackId === currentTrack._id
      ? bookmarkOverride.value
      : (currentTrack?.isBookmarked ?? false);

  const handleBookmarkToggle = () => {
    if (!isAuthenticated) {
      toast.error("You must be logged in to bookmark a song.");
      return;
    }
    if (!currentTrack?._id) return;

    const newBookmarkState = !isBookmarked;
    setBookmarkOverride({
      trackId: currentTrack._id,
      value: newBookmarkState,
    });

    toggleBookmark({ submissionId: currentTrack._id }).catch(() => {
      setBookmarkOverride({
        trackId: currentTrack._id,
        value: !newBookmarkState,
      });
      toast.error("Failed to update bookmark.");
    });
  };

  return {
    isBookmarked,
    handleBookmarkToggle,
  };
}
