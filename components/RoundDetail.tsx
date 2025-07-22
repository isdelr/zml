"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Song } from "@/types";
import { dynamicImport } from "./ui/dynamic-import";
import { useMemo } from "react";

// Dynamically import components
const RoundAdminControls = dynamicImport(() =>
  import("./round/RoundAdminControls").then((mod) => ({
    default: mod.RoundAdminControls,
  })),
);
const RoundHeader = dynamicImport(() =>
  import("./round/RoundHeader").then((mod) => ({ default: mod.RoundHeader })),
);
const SubmissionForm = dynamicImport(() =>
  import("./round/SubmissionForm").then((mod) => ({
    default: mod.SubmissionForm,
  })),
);
const SubmissionsList = dynamicImport(() =>
  import("./round/SubmissionsList").then((mod) => ({
    default: mod.SubmissionsList,
  })),
);

interface RoundDetailProps {
  round: Doc<"rounds"> & { art: string | null; submissionCount: number };
  league: { maxPositiveVotes: number; maxNegativeVotes: number };
  isOwner: boolean;
}

export function RoundDetail({ round, league, isOwner }: RoundDetailProps) {
  const {
    actions: playerActions,
    currentTrackIndex,
    isPlaying,
    queue,
  } = useMusicPlayerStore();

  const submissions = useQuery(api.submissions.getForRound, {
    roundId: round._id,
  });

  const userVoteStatus = useQuery(api.votes.getForUserInRound, {
    roundId: round._id,
  });

  const { pendingUpvotes, pendingDownvotes } = useMemo(() => {
    if (!userVoteStatus?.votes)
      return { pendingUpvotes: 0, pendingDownvotes: 0 };
    let up = 0;
    let down = 0;
    userVoteStatus.votes.forEach((vote: unknown) => {
      if (vote.vote > 0) up++;
      else if (vote.vote < 0) down++;
    });
    return { pendingUpvotes: up, pendingDownvotes: down };
  }, [userVoteStatus]);

  const positiveVotesRemaining = league.maxPositiveVotes - pendingUpvotes;
  const negativeVotesRemaining = league.maxNegativeVotes - pendingDownvotes;

  const votes = useQuery(api.votes.getForRound, { roundId: round._id });
  const currentUser = useQuery(api.users.getCurrentUser);

  const mySubmission = submissions?.find((s) => s.userId === currentUser?._id);

  const handlePlaySong = (song: Song, index: number) => {
    const isThisSongCurrent =
      currentTrackIndex !== null && queue[currentTrackIndex]?._id === song._id;
    if (isThisSongCurrent) {
      playerActions.togglePlayPause();
    } else {
      playerActions.playRound(submissions as Song[], index);
    }
  };

  return (
    <section>
      {isOwner && (
        <RoundAdminControls
          round={round}
          submissions={submissions}
          votes={votes}
        />
      )}

      <RoundHeader
        round={round}
        submissions={submissions}
        onPlayAll={(songs, startIndex) =>
          playerActions.playRound(songs, startIndex)
        }
        positiveVotesRemaining={positiveVotesRemaining}
        negativeVotesRemaining={negativeVotesRemaining}
      />

      {round.status === "submissions" && (
        <div className="mt-8">
          <SubmissionForm
            roundId={round._id}
            currentUser={currentUser}
            submissions={submissions}
            mySubmission={mySubmission}
          />

          <div className="mt-8 rounded-lg border bg-card p-6 text-center">
            <h3 className="font-semibold">Who&apos;s Submitted So Far?</h3>
            {submissions && submissions.length > 0 ? (
              <div className="mt-4 flex justify-center">
                <div className="flex items-center gap-2">
                  <span>{submissions.length} submissions</span>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No one has submitted yet. Be the first!
              </p>
            )}
          </div>
        </div>
      )}

      {(round.status === "voting" || round.status === "finished") && (
        <SubmissionsList
          submissions={submissions}
          userVoteStatus={userVoteStatus}
          currentUser={currentUser}
          roundStatus={round.status}
          league={league}
          currentTrackIndex={currentTrackIndex}
          isPlaying={isPlaying}
          queue={queue}
          onPlaySong={handlePlaySong}
        />
      )}
    </section>
  );
}
