"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { SubmissionItem } from "./SubmissionItem";
import { Song } from "@/types";
import { toast } from "sonner";

type SubmissionsListPropsSubmissions = Awaited<
  ReturnType<typeof api.submissions.getForRound>
>;
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
  onVoteClick: (submissionId: Id<"submissions">, delta: 1 | -1) => void;
  isReadyToVoteOverall: boolean;
  listenProgressMap: Record<string, Doc<"listenProgress">>;
  activeCommentsSubmissionId: Id<"submissions"> | null;
  onToggleComments: (submissionId: Id<"submissions"> | null) => void;
  listenersBySubmission: Record<string, unknown[]> | undefined;
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
                                  listenProgressMap,
                                  isReadyToVoteOverall,
                                  activeCommentsSubmissionId,
                                  onToggleComments,
                                  listenersBySubmission,
                                }: SubmissionsListProps) {
  const toggleBookmark = useMutation(
    api.bookmarks.toggleBookmark,
  ).withOptimisticUpdate((localStore, { submissionId }) => {
    const updateSubmissionInQuery = (
      queryKey: unknown,
      queryArgs: unknown,
      subs: unknown[],
    ) => {
      if (!subs) return null;
      let updated = false;
      const newSubs = subs.map((submission) => {
        if (submission._id === submissionId) {
          updated = true;
          return { ...submission, isBookmarked: !submission.isBookmarked };
        }
        return submission;
      });
      if (updated) {
        localStore.setQuery(queryKey, queryArgs, newSubs);
        return newSubs.find((s) => s._id === submissionId);
      }
      return null;
    };

    let updatedSong: Song | null = null;
    let newBookmarkState = false;

    const roundQueries = localStore.getAllQueries(api.submissions.getForRound);
    for (const { args, value } of roundQueries) {
      const result = updateSubmissionInQuery(
        api.submissions.getForRound,
        args,
        value,
      );
      if (result) {
        updatedSong = result as Song;
        newBookmarkState = result.isBookmarked;
      }
    }

    const bookmarkedQueries = localStore.getAllQueries(
      api.bookmarks.getBookmarkedSongs,
    );
    for (const { args, value: bookmarkedSongs } of bookmarkedQueries) {
      if (bookmarkedSongs && updatedSong) {
        if (newBookmarkState) {
          const exists = bookmarkedSongs.some((s) => s._id === submissionId);
          if (!exists) {
            localStore.setQuery(api.bookmarks.getBookmarkedSongs, args, [
              ...bookmarkedSongs,
              updatedSong,
            ]);
          }
        } else {
          const filtered = bookmarkedSongs.filter(
            (s) => s._id !== submissionId,
          );
          localStore.setQuery(api.bookmarks.getBookmarkedSongs, args, filtered);
        }
      }
    }
  });


  const hasVoted = userVoteStatus?.hasVoted ?? false;
  const canVote = userVoteStatus?.canVote ?? false;

  const handleBookmark = async (submissionId: Id<"submissions">) => {
    try {
      await toggleBookmark({ submissionId });
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update bookmark.");
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
  const currentTrack = currentTrackIndex !== null ? queue[currentTrackIndex] : null;

  return (
    <div className="flex flex-col rounded-lg border mt-3">
      <div className="hidden border-b border-border text-xs font-semibold uppercase text-muted-foreground md:block">
        <div className="grid grid-cols-[auto_4fr_3fr_2fr_auto] items-center gap-4 px-4 py-2">
          <span className="w-10 text-center">#</span>
          <span>Track</span>
          <span>Submitted By</span>
          <span className="text-right">Points</span>
          <span className="w-44 text-center">Actions</span>
        </div>
      </div>

      {submissions.map((song, index) => {
        const isThisSongPlaying = isPlaying && currentTrack?._id === song._id;
        const isThisSongCurrent = currentTrack?._id === song._id;
        const userIsSubmitter = song.userId === currentUser?._id;
        const isCommentsVisible = activeCommentsSubmissionId === song._id;
        const listeners = listenersBySubmission ? listenersBySubmission[song._id] : [];

        const userVoteOnThisSong = userVotes.find((v) => v.submissionId === song._id);
        const currentVoteValue = userVoteOnThisSong ? userVoteOnThisSong.vote : 0;

        return (
          <SubmissionItem
            key={song._id}
            song={song}
            index={index}
            isThisSongPlaying={isThisSongPlaying}
            isThisSongCurrent={isThisSongCurrent}
            isCommentsVisible={isCommentsVisible}
            userIsSubmitter={userIsSubmitter}
            currentVoteValue={currentVoteValue}
            roundStatus={roundStatus}
            hasVoted={hasVoted}
            league={league}
            canVote={canVote}
            onToggleComments={() => onToggleComments(isCommentsVisible ? null : song._id as Id<"submissions">)}
            onVoteClick={(delta) => onVoteClick(song._id, delta)}
            onBookmark={() => handleBookmark(song._id)}
            onPlaySong={() => onPlaySong(song, index)}
            listenProgress={listenProgressMap[song._id]}
            isReadyToVoteOverall={isReadyToVoteOverall}
            listeners={listeners ?? []}
            currentUser={currentUser}
          />
        );
      })}
    </div>
  );
}