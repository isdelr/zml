"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import type { LeagueData, RoundForLeague, UserVoteStatus } from "@/lib/convex/types";
import { toErrorMessage } from "@/lib/errors";

type ConfirmationState = {
  isOpen: boolean;
  submissionId: Id<"submissions"> | null;
  delta: 1 | -1 | null;
};

type UseRoundVotingArgs = {
  round: RoundForLeague;
  league: LeagueData;
  currentUserId: Id<"users"> | null | undefined;
  enabled?: boolean;
};

export function useRoundVoting({
  round,
  league,
  currentUserId,
  enabled = true,
}: UseRoundVotingArgs) {
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
    isOpen: false,
    submissionId: null,
    delta: null,
  });
  const [confirmText, setConfirmText] = useState("");

  const userVoteStatus = useQuery(
    api.votes.getForUserInRound,
    enabled ? { roundId: round._id } : "skip",
  );

  const castVote = useMutation(api.votes.castVote).withOptimisticUpdate(
    (
      localStore,
      {
        submissionId,
        delta,
      }: { submissionId: Id<"submissions">; delta: 1 | -1 },
    ) => {
      const voteStatus = localStore.getQuery(api.votes.getForUserInRound, {
        roundId: round._id,
      });
      if (!voteStatus || !currentUserId) return;

      const newVoteStatus = JSON.parse(
        JSON.stringify(voteStatus),
      ) as NonNullable<UserVoteStatus>;

      const idx = newVoteStatus.votes.findIndex(
        (vote: Doc<"votes">) => vote.submissionId === submissionId,
      );
      if (idx > -1) {
        const existingVote = newVoteStatus.votes[idx];
        if (!existingVote) return;
        const currentVal = existingVote.vote;
        const nextVal = currentVal + delta;
        if (nextVal === 0) {
          newVoteStatus.votes.splice(idx, 1);
        } else {
          existingVote.vote = nextVal;
        }
      } else {
        const optimisticVoteId =
          `optimistic_${submissionId}_${newVoteStatus.votes.length}` as Id<"votes">;
        newVoteStatus.votes.push({
          _id: optimisticVoteId,
          _creationTime: 0,
          roundId: round._id,
          submissionId,
          userId: currentUserId,
          vote: delta,
        });
      }

      newVoteStatus.upvotesUsed = newVoteStatus.votes.reduce(
        (sum: number, vote: Doc<"votes">) => sum + Math.max(0, vote.vote),
        0,
      );
      newVoteStatus.downvotesUsed = newVoteStatus.votes.reduce(
        (sum: number, vote: Doc<"votes">) => sum + Math.abs(Math.min(0, vote.vote)),
        0,
      );

      const effectiveMaxUp = round.maxPositiveVotes ?? league.maxPositiveVotes;
      const effectiveMaxDown = round.maxNegativeVotes ?? league.maxNegativeVotes;
      newVoteStatus.hasVoted =
        newVoteStatus.upvotesUsed === effectiveMaxUp &&
        newVoteStatus.downvotesUsed === effectiveMaxDown;

      localStore.setQuery(
        api.votes.getForUserInRound,
        { roundId: round._id },
        newVoteStatus,
      );
    },
  );

  const closeConfirmation = useCallback(() => {
    setConfirmationState({ isOpen: false, submissionId: null, delta: null });
    setConfirmText("");
  }, []);

  const submitVoteDelta = useCallback(
    (submissionId: Id<"submissions">, delta: 1 | -1) => {
      castVote({ submissionId, delta })
        .then((result) => {
          if (result.isFinal) {
            toast.success(result.message);
          }
        })
        .catch((error: unknown) => {
          toast.error(toErrorMessage(error, "Failed to save vote."));
        });
    },
    [castVote],
  );

  const handleConfirmFinalVote = useCallback(() => {
    if (confirmationState.submissionId && confirmationState.delta) {
      submitVoteDelta(confirmationState.submissionId, confirmationState.delta);
    }
    closeConfirmation();
  }, [confirmationState, submitVoteDelta, closeConfirmation]);

  const handleVoteClick = useCallback(
    (submissionId: Id<"submissions">, delta: 1 | -1) => {
      if (userVoteStatus?.hasVoted) {
        toast.info("Your votes for this round are final and cannot be changed.");
        return;
      }

      const upvotesUsed = userVoteStatus?.upvotesUsed ?? 0;
      const downvotesUsed = userVoteStatus?.downvotesUsed ?? 0;
      const currentVote =
        userVoteStatus?.votes.find((vote) => vote.submissionId === submissionId)
          ?.vote ?? 0;

      let nextVote = currentVote + delta;
      if (league.limitVotesPerSubmission) {
        if (nextVote > (league.maxPositiveVotesPerSubmission ?? Infinity)) {
          nextVote = league.maxPositiveVotesPerSubmission ?? nextVote;
        }
        if (nextVote < -(league.maxNegativeVotesPerSubmission ?? Infinity)) {
          nextVote = -(league.maxNegativeVotesPerSubmission ?? nextVote);
        }
      }
      const deltaToSend = (nextVote - currentVote) as -1 | 0 | 1;
      if (deltaToSend === 0) return;

      const nextUpvotesUsed =
        upvotesUsed - Math.max(0, currentVote) + Math.max(0, nextVote);
      const nextDownvotesUsed =
        downvotesUsed -
        Math.abs(Math.min(0, currentVote)) +
        Math.abs(Math.min(0, nextVote));

      const effectiveMaxUpClick = round.maxPositiveVotes ?? league.maxPositiveVotes;
      const effectiveMaxDownClick = round.maxNegativeVotes ?? league.maxNegativeVotes;
      const willBeFinal =
        nextUpvotesUsed === effectiveMaxUpClick &&
        nextDownvotesUsed === effectiveMaxDownClick;

      if (willBeFinal) {
        setConfirmationState({
          isOpen: true,
          submissionId,
          delta: deltaToSend as 1 | -1,
        });
        return;
      }

      submitVoteDelta(submissionId, deltaToSend as 1 | -1);
    },
    [userVoteStatus, league, round, submitVoteDelta],
  );

  const upvotesUsed = userVoteStatus?.upvotesUsed ?? 0;
  const downvotesUsed = userVoteStatus?.downvotesUsed ?? 0;
  const effectiveMaxUp = round.maxPositiveVotes ?? league.maxPositiveVotes;
  const effectiveMaxDown = round.maxNegativeVotes ?? league.maxNegativeVotes;

  const summary = useMemo(
    () => ({
      upvotesUsed,
      downvotesUsed,
      effectiveMaxUp,
      effectiveMaxDown,
      positiveVotesRemaining: Math.max(0, effectiveMaxUp - upvotesUsed),
      negativeVotesRemaining: Math.max(0, effectiveMaxDown - downvotesUsed),
      isVoteFinal: userVoteStatus?.hasVoted ?? false,
      usesCustomLimits:
        ((round.maxPositiveVotes ?? null) !== null &&
          round.maxPositiveVotes !== league.maxPositiveVotes) ||
        ((round.maxNegativeVotes ?? null) !== null &&
          round.maxNegativeVotes !== league.maxNegativeVotes),
    }),
    [
      upvotesUsed,
      downvotesUsed,
      effectiveMaxUp,
      effectiveMaxDown,
      userVoteStatus?.hasVoted,
      round.maxPositiveVotes,
      round.maxNegativeVotes,
      league.maxPositiveVotes,
      league.maxNegativeVotes,
    ],
  );

  return {
    userVoteStatus,
    confirmationState,
    confirmText,
    setConfirmText,
    closeConfirmation,
    handleConfirmFinalVote,
    handleVoteClick,
    ...summary,
  };
}
