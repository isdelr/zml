"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SubmissionItem } from "./SubmissionItem";
import { Song } from "@/types";

interface SubmissionsListProps {
  submissions:
    | (Song & {
        league: { maxPositiveVotes: number; maxNegativeVotes: number };
      })[]
    | undefined;
  userVoteStatus: unknown;
  currentUser: unknown;
  roundStatus: "voting" | "finished" | "submissions";
  league: {
    maxPositiveVotes: number;
    maxNegativeVotes: number;
  };
  currentTrackIndex: number | null;
  isPlaying: boolean;
  queue: Song[];
  onPlaySong: (song: Song, index: number) => void;
  pendingVotes: Record<string, { up: number; down: number }>;
  onVoteClick: (
    submissionId: Id<"submissions">,
    voteType: "up" | "down",
  ) => void;
  onSubmitVotes: () => void;
}

export function SubmissionsList({
  submissions,
  userVoteStatus,
  currentUser,
  roundStatus,
  league,
  currentTrackIndex,
  isPlaying,
  queue,
  onPlaySong,
  pendingVotes,
  onVoteClick,
  onSubmitVotes,
}: SubmissionsListProps) {
  const [visibleComments, setVisibleComments] = useState<
    Record<string, boolean>
  >({});

  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);

  const toggleComments = (submissionId: Id<"submissions">) => {
    setVisibleComments((prev) => ({
      ...prev,
      [submissionId]: !prev[submissionId],
    }));
  };

  const hasVoted = userVoteStatus?.hasVoted ?? false;

  const handleBookmark = (submissionId: Id<"submissions">) => {
    toast.promise(toggleBookmark({ submissionId }), {
      loading: "Updating bookmark...",
      success: (data) =>
        data.bookmarked ? "Song bookmarked!" : "Bookmark removed.",
      error: (err) => err.data?.message || "Failed to update bookmark.",
      position: "bottom-left",
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

  const getVoteCounts = () => {
    const up = Object.values(pendingVotes).reduce((s, v) => s + v.up, 0);
    const down = Object.values(pendingVotes).reduce((s, v) => s + v.down, 0);
    return {
      positiveVotesRemaining: league.maxPositiveVotes - up,
      negativeVotesRemaining: league.maxNegativeVotes - down,
    };
  };

  const { positiveVotesRemaining, negativeVotesRemaining } = getVoteCounts();

  const canSubmit =
    positiveVotesRemaining === 0 && negativeVotesRemaining === 0;

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
        const pendingSongVotes = pendingVotes[song._id] || { up: 0, down: 0 };
        const isCommentsVisible = !!visibleComments[song._id];

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
            pendingSongVotes={pendingSongVotes}
            roundStatus={roundStatus}
            hasVoted={hasVoted}
            onToggleComments={() => toggleComments(song._id)}
            onVoteClick={(voteType) => onVoteClick(song._id, voteType)}
            onBookmark={() => handleBookmark(song._id)}
            onPlaySong={() => {
              if (isLinkSubmission && song.songLink) {
                window.open(song.songLink, "_blank", "noopener,noreferrer");
              } else if (isThisSongCurrent) {
                onPlaySong(song, index);
              } else {
                onPlaySong(song, index);
              }
            }}
          />
        );
      })}

      {roundStatus === "voting" &&
        submissions.length > 0 &&
        !userVoteStatus?.hasVoted && (
          <div className="sticky bottom-20 z-10 mt-8 flex justify-end md:bottom-4">
            <Button
              onClick={onSubmitVotes}
              disabled={!canSubmit}
              size="lg"
              className="shadow-lg"
            >
              {canSubmit ? "Submit Final Votes" : "Use All Votes to Submit"}
            </Button>
          </div>
        )}
    </div>
  );
}