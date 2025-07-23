"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Song } from "@/types";
import { dynamicImport } from "./ui/dynamic-import";
import { useMemo, useState, useEffect } from "react";
import { AvatarStack } from "./AvatarStack";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

 
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

  const submitVotes = useMutation(api.votes.submitVotes);

  const submissions = useQuery(api.submissions.getForRound, {
    roundId: round._id,
  });

  const userVoteStatus = useQuery(api.votes.getForUserInRound, {
    roundId: round._id,
  });

  const voters = useQuery(api.votes.getVotersForRound, { roundId: round._id });

  const [pendingVotes, setPendingVotes] = useState<
    Record<string, { up: number; down: number }>
  >({});

  useEffect(() => {
    if (userVoteStatus?.votes && submissions) {
      const initialVotes: Record<string, { up: number; down: number }> = {};
      submissions.forEach((sub) => {
        initialVotes[sub._id] = { up: 0, down: 0 };
      });

      userVoteStatus.votes.forEach(
        (vote: { submissionId: Id<"submissions">; vote: number }) => {
          if (initialVotes[vote.submissionId]) {
            if (vote.vote > 0) {
              initialVotes[vote.submissionId].up += 1;
            } else if (vote.vote < 0) {
              initialVotes[vote.submissionId].down += 1;
            }
          }
        },
      );
      setPendingVotes(initialVotes);
    } else if (submissions) {
       
      const initialVotes: Record<string, { up: number; down: number }> = {};
      submissions.forEach((sub) => {
        initialVotes[sub._id] = { up: 0, down: 0 };
      });
      setPendingVotes(initialVotes);
    }
   
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userVoteStatus, submissions?.length]);

  const { pendingUpvotes, pendingDownvotes } = useMemo(() => {
    return Object.values(pendingVotes).reduce(
      (acc, votes) => {
        acc.pendingUpvotes += votes.up;
        acc.pendingDownvotes += votes.down;
        return acc;
      },
      { pendingUpvotes: 0, pendingDownvotes: 0 },
    );
  }, [pendingVotes]);

  const positiveVotesRemaining = league.maxPositiveVotes - pendingUpvotes;
  const negativeVotesRemaining = league.maxNegativeVotes - pendingDownvotes;

  const canSubmit =
    positiveVotesRemaining === 0 && negativeVotesRemaining === 0;

  const handleSubmitVotes = () => {
    if (!canSubmit) {
      toast.error("You must use all your available votes before submitting.");
      return;
    }

    const votesToSubmit = Object.entries(pendingVotes).flatMap(
      ([submissionId, votes]) => [
        ...Array(votes.up).fill({
          submissionId: submissionId as Id<"submissions">,
          voteType: "up",
        }),
        ...Array(votes.down).fill({
          submissionId: submissionId as Id<"submissions">,
          voteType: "down",
        }),
      ],
    );

    toast.promise(
      submitVotes({
        roundId: round._id,
        votes: votesToSubmit,
      }),
      {
        loading: "Submitting votes...",
        success: "Votes submitted successfully!",
        error: (err) => err.data?.message || "Failed to submit votes.",
      },
    );
  };

  const sortedSubmissions = useMemo(() => {
    if (!submissions) return undefined;
    return [...submissions].sort((a, b) => {
      const aIsFile = a.submissionType === "file";
      const bIsFile = b.submissionType === "file";
      if (aIsFile && !bIsFile) return -1;
      if (!aIsFile && bIsFile) return 1;
      return 0;
    });
  }, [submissions]);

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

  const handleVoteClick = (
    submissionId: Id<"submissions">,
    voteType: "up" | "down",
  ) => {
    setPendingVotes((prev) => {
      const newVotes = JSON.parse(JSON.stringify(prev));
      const songVotes = newVotes[submissionId] ?? { up: 0, down: 0 };

      if (voteType === "up") {
        if (songVotes.down > 0) {
          songVotes.down -= 1;
        } else if (positiveVotesRemaining > 0) {
          songVotes.up += 1;
        } else if (songVotes.up > 0) {
          songVotes.up -= 1;
        } else {
          toast.warning("No upvotes remaining.");
        }
      } else {
         
        if (songVotes.up > 0) {
          songVotes.up -= 1;
        } else if (negativeVotesRemaining > 0) {
          songVotes.down += 1;
        } else if (songVotes.down > 0) {
          songVotes.down -= 1;
        } else {
          toast.warning("No downvotes remaining.");
        }
      }
      newVotes[submissionId] = songVotes;
      return newVotes;
    });
  };
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


      {round.status === "voting" &&
        userVoteStatus &&
        !userVoteStatus.hasVoted &&
        !userVoteStatus.canVote && (
          <Alert className="mb-8 border-yellow-500/50 bg-yellow-500/10 text-yellow-400">
            <Ban className="size-5" />
            <AlertTitle className="font-bold">Voting Restricted</AlertTitle>
            <AlertDescription className="text-yellow-400/80">
              You cannot vote in this round because you joined the league after
              the voting phase started. You can vote in all future rounds.
            </AlertDescription>
          </Alert>
        )}

      <RoundHeader
        round={round}
        submissions={sortedSubmissions}
        onPlayAll={(songs, startIndex) =>
          playerActions.playRound(songs, startIndex)
        }
        positiveVotesRemaining={positiveVotesRemaining}
        negativeVotesRemaining={negativeVotesRemaining}
        hasVoted={userVoteStatus?.hasVoted ?? false}
        upvotesUsed={pendingUpvotes}
        downvotesUsed={pendingDownvotes}
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
        <>
          {round.status === "voting" && voters && voters.length > 0 && (
            <div className="my-8 rounded-lg border bg-card p-6 text-center">
              <h3 className="font-semibold">Who&apos;s Voted So Far?</h3>
              <div className="mt-4 flex flex-col items-center justify-center gap-2">
                <AvatarStack users={voters} />
                <p className="text-sm text-muted-foreground">
                  {voters.length} member{voters.length !== 1 ? "s" : ""} have
                  cast their votes.
                </p>
              </div>
            </div>
          )}
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
            pendingVotes={pendingVotes}
            onVoteClick={handleVoteClick}
            onSubmitVotes={handleSubmitVotes}
          />
        </>
      )}
    </section>
  );
}