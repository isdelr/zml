// components/round/SubmissionsList.tsx
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
  league: NonNullable<Awaited<ReturnType<typeof api.leagues.get>>>;
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
  league,
  currentTrackIndex,
  isPlaying,
  queue,
  onPlaySong,
  onVoteClick,
}: SubmissionsListProps) {
  const [visibleComments, setVisibleComments] = useState<
    Record<string, boolean>
  >({});

  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark)
    .withOptimisticUpdate((localStore, { submissionId }) => {
      // Update all possible queries that might contain this submission
      const updateSubmissionInQuery = (queryKey: unknown, queryArgs: unknown, submissions: unknown[]) => {
        if (!submissions) return null;
        
        let updated = false;
        const newSubmissions = submissions.map((submission) => {
          if (submission._id === submissionId) {
            updated = true;
            return { 
              ...submission, 
              isBookmarked: !submission.isBookmarked 
            };
          }
          return submission;
        });
        
        if (updated) {
          localStore.setQuery(queryKey, queryArgs, newSubmissions);
          return newSubmissions.find(s => s._id === submissionId);
        }
        return null;
      };

      let updatedSong: Song | null = null;
      let newBookmarkState = false;

      // Update submissions.getForRound queries
      const roundQueries = localStore.getAllQueries(api.submissions.getForRound);
      for (const { args, value } of roundQueries) {
        const result = updateSubmissionInQuery(api.submissions.getForRound, args, value);
        if (result) {
          updatedSong = result as Song;
          newBookmarkState = result.isBookmarked;
        }
      }

      // Update bookmarked songs list
      const bookmarkedQueries = localStore.getAllQueries(api.bookmarks.getBookmarkedSongs);
      for (const { args, value: bookmarkedSongs } of bookmarkedQueries) {
        if (bookmarkedSongs && updatedSong) {
          if (newBookmarkState) {
            // Adding bookmark - add to list if not already there
            const exists = bookmarkedSongs.some(s => s._id === submissionId);
            if (!exists) {
              localStore.setQuery(
                api.bookmarks.getBookmarkedSongs, 
                args, 
                [...bookmarkedSongs, updatedSong]
              );
            }
          } else {
            // Removing bookmark - remove from list
            const filtered = bookmarkedSongs.filter(s => s._id !== submissionId);
            localStore.setQuery(api.bookmarks.getBookmarkedSongs, args, filtered);
          }
        }
      }

    });

  const toggleComments = (submissionId: string) => {
    setVisibleComments((prev) => ({
      ...prev,
      [submissionId]: !prev[submissionId],
    }));
  };

  const hasVoted = userVoteStatus?.hasVoted ?? false;
  const canVote = userVoteStatus?.canVote ?? false;

  const handleBookmark = async (submissionId: Id<"submissions">) => {
    try {
      await toggleBookmark({ submissionId });
    } catch (err: unknown) {
      toast.error(err.data?.message || "Failed to update bookmark.");
    }
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
            league={league}
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