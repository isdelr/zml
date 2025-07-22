"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Song } from "@/types";
import { dynamicImport } from "./ui/dynamic-import";
import { useMemo } from "react";
import { AvatarStack } from "./AvatarStack";

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

  const sortedSubmissions = useMemo(() => {
    if (!submissions) return undefined;
    return [...submissions].sort((a, b) => {
      const aIsFile = a.submissionType === 'file';
      const bIsFile = b.submissionType === 'file';
      if (aIsFile && !bIsFile) return -1;
      if (!aIsFile && bIsFile) return 1;
      return 0;
    });
  }, [submissions]);

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

  const submittedUsers = useMemo(() => {
    if (!submissions) return [];
    return submissions.map((sub) => ({
      name: sub.submittedBy,
      image: sub.submittedByImage,
    }));
  }, [submissions]);

  const handlePlaySong = (song: Song, index: number) => {
    const isThisSongCurrent =
      currentTrackIndex !== null && queue[currentTrackIndex]?._id === song._id;
    if (isThisSongCurrent) {
      playerActions.togglePlayPause();
    } else {
      playerActions.playRound(sortedSubmissions as Song[], index);
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
        submissions={sortedSubmissions}
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
              <div className="mt-4 flex flex-col items-center justify-center gap-2">
                <AvatarStack users={submittedUsers} />
                <p className="text-sm text-muted-foreground">
                  {submissions.length} submission
                  {submissions.length > 1 ? "s" : ""}
                </p>
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
          submissions={sortedSubmissions}
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