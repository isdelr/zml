"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { SubmissionItem } from "./SubmissionItem";
import { Song } from "@/types";

type SubmissionsListPropsSubmissions = Awaited<ReturnType<typeof api.submissions.getForRound>>;
type UserVoteStatus = Awaited<ReturnType<typeof api.votes.getForUserInRound>>;

interface SubmissionsListProps {
  submissions: SubmissionsListPropsSubmissions | undefined;
  userVoteStatus: UserVoteStatus | undefined;
  userVotes: Doc<"votes">[];
  currentUser: Doc<"users"> | null | undefined;
  roundStatus: "voting" | "finished" | "submissions";
  league: {
    maxPositiveVotes: number;
    maxNegativeVotes: number;
  };
  currentTrackIndex: number | null;
  isPlaying: boolean;
  queue: Song[];
  onPlaySong: (song: Song, index: number) => void;
  onVoteClick: (
    submissionId: Id<"submissions">,
    voteType: "up" | "down" | "none",
  ) => void;
}

export function SubmissionsList({
  submissions,
  userVoteStatus,
  userVotes,
  currentUser,
  roundStatus,
  currentTrackIndex,
  isPlaying,
  queue,
  onPlaySong,
  onVoteClick,
}: SubmissionsListProps) {
  const [visibleComments, setVisibleComments] = useState<
    Record<string, boolean>
  >({});

  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark).withOptimisticUpdate(
    (localStore, { submissionId }) => {
      const roundQueries = localStore.getQuery(api.submissions.getForRound);
      if (roundQueries) {
        for (const [queryArgs, currentSubmissions] of roundQueries.entries()) {
          if (currentSubmissions?.some(s => s._id === submissionId)) {
            const newSubmissions = currentSubmissions.map(s =>
              s._id === submissionId ? { ...s, isBookmarked: !s.isBookmarked } : s
            );
            localStore.setQuery(api.submissions.getForRound, queryArgs, newSubmissions);
          }
        }
      }

      const bookmarkedSongs = localStore.getQuery(api.bookmarks.getBookmarkedSongs, {});
      if (bookmarkedSongs) {
        const isCurrentlyBookmarked = bookmarkedSongs.some(s => s._id === submissionId);
        if (isCurrentlyBookmarked) {
          localStore.setQuery(api.bookmarks.getBookmarkedSongs, {}, bookmarkedSongs.filter(s => s._id !== submissionId));
        } else {
          // As before, we don't optimistically add here.
        }
      }
    }
  );


  const toggleComments = (submissionId: string) => {
    setVisibleComments((prev) => ({
      ...prev,
      [submissionId]: !prev[submissionId],
    }));
  };

  const hasVoted = userVoteStatus?.hasVoted ?? false;
  const canVote = userVoteStatus?.canVote ?? false;

  const handleBookmark = (submissionId: Id<"submissions">) => {
    toggleBookmark({ submissionId }).catch((err) => {
      toast.error(err.data?.message || "Failed to update bookmark.");
    });
  };

  if (!submissions || submissions.length === 0) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-semibold">No Submissions</h2>
        <p className="mt-2 text-muted-foreground">
          Looks like no one submitted a track for this round.
        </p>
      </div>
    );
  }

  const currentTrack =
    currentTrackIndex !== null ? queue[currentTrackIndex] : null;

  return (
    <div className="flex flex-col">
      <div className="hidden border-b border-border text-xs font-semibold uppercase text-muted-foreground md:block">
        <div className="grid grid-cols-[auto_4fr_3fr_2fr_auto] items-center gap-4 px-4 py-2">
          <span className="w-10 text-center">#</span>
          <span>TRACK</span>
          <span>SUBMITTED BY</span>
          <span className="text-right">POINTS</span>
          <span className="w-40 text-center">ACTIONS</span>
        </div>
      </div>

      {submissions.map((song, index) => {
        const isThisSongPlaying = isPlaying && currentTrack?._id === song._id;
        const isThisSongCurrent = currentTrack?._id === song._id;
        const isLinkSubmission =
          song.submissionType === "spotify" ||
          song.submissionType === "youtube";
        const userIsSubmitter = song.userId === currentUser?._id;
        const isCommentsVisible = !!visibleComments[song._id];

        const userVoteOnThisSong = userVotes.find(v => v.submissionId === song._id);
        const currentVoteState = userVoteOnThisSong ? (userVoteOnThisSong.vote > 0 ? 'up' : 'down') : 'none';

        return (
          <SubmissionItem
            key={song._id}
            song={song}
            index={index}
            isThisSongPlaying={isThisSongPlaying}
            isThisSongCurrent={isThisSongCurrent}
            isLinkSubmission={isLinkSubmission}
            isCommentsVisible={isCommentsVisible}
            userIsSubmitter={userIsSubmitter}
            currentVoteState={currentVoteState}
            roundStatus={roundStatus}
            hasVoted={hasVoted}
            canVote={canVote}
            onToggleComments={() => toggleComments(song._id)}
            onVoteClick={(newVoteState) => onVoteClick(song._id, newVoteState)}
            onBookmark={() => handleBookmark(song._id)}
            onPlaySong={() => onPlaySong(song, index)}
          />
        );
      })}
    </div>
  );
}