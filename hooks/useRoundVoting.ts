"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import type { LeagueData, RoundForLeague, UserVoteStatus } from "@/lib/convex/types";
import { toErrorMessage } from "@/lib/errors";
import {
  calculateVoteStep,
  getVoteStepErrorMessage,
} from "@/lib/rounds/vote-step";

const FINAL_CONFIRM_TEXT = "confirm";
const FINAL_CONFIRMATION_REQUIRED_TEXT =
  "confirmation is required to lock your votes";
const LOCKED_TOAST_COOLDOWN_MS = 1200;

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
  canFinalizeVotes?: boolean;
  finalizationBlockedReason?: string;
};

export function useRoundVoting({
  round,
  league,
  currentUserId,
  enabled = true,
  canFinalizeVotes = true,
  finalizationBlockedReason = "Finish listening to every required song before submitting your final vote.",
}: UseRoundVotingArgs) {
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
    isOpen: false,
    submissionId: null,
    delta: null,
  });
  const [confirmText, setConfirmText] = useState("");
  const voteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingVoteOpsRef = useRef(0);
  const confirmationLockRef = useRef(false);
  const lastLockedToastAtRef = useRef(0);

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
        const effectiveMaxUp = round.maxPositiveVotes ?? league.maxPositiveVotes;
        const effectiveMaxDown =
          round.maxNegativeVotes ?? league.maxNegativeVotes;
        const voteStep = calculateVoteStep({
          currentVote: currentVal,
          delta,
          upvotesUsed: newVoteStatus.upvotesUsed,
          downvotesUsed: newVoteStatus.downvotesUsed,
          maxUp: effectiveMaxUp,
          maxDown: effectiveMaxDown,
          limitVotesPerSubmission: league.limitVotesPerSubmission === true,
          maxPositiveVotesPerSubmission: league.maxPositiveVotesPerSubmission,
          maxNegativeVotesPerSubmission: league.maxNegativeVotesPerSubmission,
        });
        if (voteStep.errorCode) return;

        const nextVal = voteStep.nextVote;
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

  const notifyLocked = useCallback((message: string) => {
    const now = Date.now();
    if (now - lastLockedToastAtRef.current < LOCKED_TOAST_COOLDOWN_MS) {
      return;
    }
    lastLockedToastAtRef.current = now;
    toast.info(message);
  }, []);

  const closeConfirmation = useCallback(() => {
    confirmationLockRef.current = false;
    setConfirmationState({ isOpen: false, submissionId: null, delta: null });
    setConfirmText("");
  }, []);

  const submitVoteDelta = useCallback(
    (
      submissionId: Id<"submissions">,
      delta: 1 | -1,
      confirmFinal = false,
    ) => {
      pendingVoteOpsRef.current += 1;
      voteQueueRef.current = voteQueueRef.current.then(async () => {
        try {
          const result = await castVote({ submissionId, delta, confirmFinal });
          if (result.isFinal) {
            toast.success(result.message);
          }
        } catch (error: unknown) {
          const errorMessage = toErrorMessage(error, "Failed to save vote.");
          if (
            errorMessage
              .toLowerCase()
              .includes(FINAL_CONFIRMATION_REQUIRED_TEXT)
          ) {
            confirmationLockRef.current = true;
            setConfirmationState({
              isOpen: true,
              submissionId,
              delta,
            });
            setConfirmText("");
            return;
          }
          toast.error(errorMessage);
        } finally {
          pendingVoteOpsRef.current = Math.max(0, pendingVoteOpsRef.current - 1);
        }
      });
    },
    [castVote],
  );

  const handleConfirmFinalVote = useCallback(() => {
    if (pendingVoteOpsRef.current > 0) {
      notifyLocked("Please wait for your previous vote to finish saving.");
      return;
    }
    if (!canFinalizeVotes) {
      toast.error(finalizationBlockedReason);
      closeConfirmation();
      return;
    }
    if (confirmText.trim().toLowerCase() !== FINAL_CONFIRM_TEXT) {
      toast.error('Type "confirm" to submit your final vote.');
      return;
    }
    if (confirmationState.submissionId && confirmationState.delta) {
      submitVoteDelta(
        confirmationState.submissionId,
        confirmationState.delta,
        true,
      );
    }
    closeConfirmation();
  }, [
    canFinalizeVotes,
    confirmationState,
    submitVoteDelta,
    closeConfirmation,
    confirmText,
    finalizationBlockedReason,
    notifyLocked,
  ]);

  const handleVoteClick = useCallback(
    (submissionId: Id<"submissions">, delta: 1 | -1) => {
      if (pendingVoteOpsRef.current > 0) {
        notifyLocked("Please wait for your previous vote to finish saving.");
        return;
      }
      if (confirmationLockRef.current) {
        notifyLocked("Complete or cancel the final-vote confirmation first.");
        return;
      }
      if (userVoteStatus?.hasVoted) {
        toast.info("Your votes for this round are final and cannot be changed.");
        return;
      }

      const upvotesUsed = userVoteStatus?.upvotesUsed ?? 0;
      const downvotesUsed = userVoteStatus?.downvotesUsed ?? 0;
      const currentVote =
        userVoteStatus?.votes.find((vote) => vote.submissionId === submissionId)
          ?.vote ?? 0;
      const effectiveMaxUpClick = round.maxPositiveVotes ?? league.maxPositiveVotes;
      const effectiveMaxDownClick = round.maxNegativeVotes ?? league.maxNegativeVotes;
      const voteStep = calculateVoteStep({
        currentVote,
        delta,
        upvotesUsed,
        downvotesUsed,
        maxUp: effectiveMaxUpClick,
        maxDown: effectiveMaxDownClick,
        limitVotesPerSubmission: league.limitVotesPerSubmission === true,
        maxPositiveVotesPerSubmission: league.maxPositiveVotesPerSubmission,
        maxNegativeVotesPerSubmission: league.maxNegativeVotesPerSubmission,
      });
      if (voteStep.errorCode) {
        toast.error(getVoteStepErrorMessage(voteStep.errorCode));
        return;
      }

      const deltaToSend = (voteStep.nextVote - currentVote) as -1 | 0 | 1;
      if (deltaToSend === 0) return;

      const willBeFinal =
        voteStep.nextUpvotesUsed === effectiveMaxUpClick &&
        voteStep.nextDownvotesUsed === effectiveMaxDownClick;

      if (willBeFinal) {
        if (!canFinalizeVotes) {
          toast.error(finalizationBlockedReason);
          return;
        }
        confirmationLockRef.current = true;
        setConfirmationState({
          isOpen: true,
          submissionId,
          delta: deltaToSend as 1 | -1,
        });
        return;
      }

      submitVoteDelta(submissionId, deltaToSend as 1 | -1);
    },
    [
      canFinalizeVotes,
      finalizationBlockedReason,
      userVoteStatus,
      league,
      round,
      submitVoteDelta,
      notifyLocked,
    ],
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
