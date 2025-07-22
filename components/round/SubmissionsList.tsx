"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SubmissionItem } from "./SubmissionItem";
import { Song } from "@/types";

interface SubmissionsListProps {
  submissions: unknown[] | undefined;
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
}: SubmissionsListProps) {
  const [visibleComments, setVisibleComments] = useState<
    Record<string, boolean>
  >({});
  const [pendingVotes, setPendingVotes] = useState<
    Record<string, { up: number; down: number }>
  >({});

  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);
  const submitVotes = useMutation(api.votes.submitVotes);

  // Initialize pending votes from user vote status
  useMemo(() => {
    if (userVoteStatus?.votes && submissions) {
      const initialVotes: Record<string, { up: number; down: number }> = {};
      submissions.forEach((sub) => {
        initialVotes[sub._id] = { up: 0, down: 0 };
      });

      userVoteStatus.votes.forEach((vote: unknown) => {
        if (vote.vote > 0) {
          initialVotes[vote.submissionId].up += 1;
        } else if (vote.vote < 0) {
          initialVotes[vote.submissionId].down += 1;
        }
      });
      setPendingVotes(initialVotes);
    }
  }, [userVoteStatus, submissions]);

  const { pendingUpvotes, pendingDownvotes } = useMemo(() => {
    let up = 0;
    let down = 0;
    for (const subId in pendingVotes) {
      up += pendingVotes[subId].up;
      down += pendingVotes[subId].down;
    }
    return { pendingUpvotes: up, pendingDownvotes: down };
  }, [pendingVotes]);

  const positiveVotesRemaining = league.maxPositiveVotes - pendingUpvotes;
  const negativeVotesRemaining = league.maxNegativeVotes - pendingDownvotes;

  const canSubmit =
    positiveVotesRemaining === 0 && negativeVotesRemaining === 0;

  const toggleComments = (submissionId: Id<"submissions">) => {
    setVisibleComments((prev) => ({
      ...prev,
      [submissionId]: !prev[submissionId],
    }));
  };

  const handleVoteClick = (
    submissionId: Id<"submissions">,
    voteType: "up" | "down",
  ) => {
    setPendingVotes((prev) => {
      const newVotes = JSON.parse(JSON.stringify(prev));
      const currentSongVotes = newVotes[submissionId] || { up: 0, down: 0 };

      if (voteType === "up") {
        if (currentSongVotes.down > 0) {
          currentSongVotes.down -= 1;
        } else if (positiveVotesRemaining > 0) {
          currentSongVotes.up += 1;
        } else {
          toast.warning("No upvotes remaining.");
        }
      } else if (voteType === "down") {
        if (currentSongVotes.up > 0) {
          currentSongVotes.up -= 1;
        } else if (negativeVotesRemaining > 0) {
          currentSongVotes.down += 1;
        } else {
          toast.warning("No downvotes remaining.");
        }
      }
      newVotes[submissionId] = currentSongVotes;
      return newVotes;
    });
  };

  const handleSubmitVotes = () => {
    if (!canSubmit) {
      toast.error("You must use all your available votes before submitting.");
      return;
    }

    const votesToSubmit: {
      submissionId: Id<"submissions">;
      voteType: "up" | "down";
    }[] = [];
    for (const submissionId in pendingVotes) {
      const { up, down } = pendingVotes[submissionId];
      for (let i = 0; i < up; i++) {
        votesToSubmit.push({
          submissionId: submissionId as Id<"submissions">,
          voteType: "up",
        });
      }
      for (let i = 0; i < down; i++) {
        votesToSubmit.push({
          submissionId: submissionId as Id<"submissions">,
          voteType: "down",
        });
      }
    }

    toast.promise(
      submitVotes({
        roundId: submissions[0].roundId,
        votes: votesToSubmit,
      }),
      {
        loading: "Submitting votes...",
        success: "Votes submitted successfully!",
        error: (err) => err.data?.message || "Failed to submit votes.",
      },
    );
  };

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

  return (
    <div className="flex flex-col">
      <div className="hidden border-b border-border text-xs font-semibold uppercase text-muted-foreground md:block">
        <div className="grid grid-cols-[auto_4fr_3fr_2fr_auto] items-center gap-4 px-4 py-2">
          <span className="w-10 text-center">#</span>
          <span>TRACK</span>
          <span>SUBMITTED BY</span>

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
            onToggleComments={() => toggleComments(song._id)}
            onVoteClick={(voteType) => handleVoteClick(song._id, voteType)}
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
          <div className="mt-8 flex justify-end">
            <Button onClick={handleSubmitVotes} disabled={!canSubmit} size="lg">
              {canSubmit ? "Submit Final Votes" : "Use All Votes to Submit"}
            </Button>
          </div>
        )}
    </div>
  );
}