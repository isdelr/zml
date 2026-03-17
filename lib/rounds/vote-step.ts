export type VoteStepErrorCode =
  | "max_upvotes_per_submission"
  | "max_downvotes_per_submission"
  | "no_upvotes_remaining"
  | "no_downvotes_remaining";

export type VoteStepResult = {
  nextVote: number;
  nextUpvotesUsed: number;
  nextDownvotesUsed: number;
  errorCode: VoteStepErrorCode | null;
};

type CalculateVoteStepArgs = {
  currentVote: number;
  delta: 1 | -1;
  upvotesUsed: number;
  downvotesUsed: number;
  maxUp: number;
  maxDown: number;
  limitVotesPerSubmission: boolean;
  maxPositiveVotesPerSubmission?: number | null;
  maxNegativeVotesPerSubmission?: number | null;
};

export function calculateVoteStep({
  currentVote,
  delta,
  upvotesUsed,
  downvotesUsed,
  maxUp,
  maxDown,
  limitVotesPerSubmission,
  maxPositiveVotesPerSubmission,
  maxNegativeVotesPerSubmission,
}: CalculateVoteStepArgs): VoteStepResult {
  const nextVote = currentVote + delta;

  if (limitVotesPerSubmission) {
    const maxPositive = maxPositiveVotesPerSubmission ?? 1;
    const maxNegative = maxNegativeVotesPerSubmission ?? 0;

    if (nextVote > maxPositive) {
      return {
        nextVote,
        nextUpvotesUsed: upvotesUsed,
        nextDownvotesUsed: downvotesUsed,
        errorCode: "max_upvotes_per_submission",
      };
    }

    if (nextVote < -maxNegative) {
      return {
        nextVote,
        nextUpvotesUsed: upvotesUsed,
        nextDownvotesUsed: downvotesUsed,
        errorCode: "max_downvotes_per_submission",
      };
    }
  }

  const nextUpvotesUsed =
    upvotesUsed - Math.max(0, currentVote) + Math.max(0, nextVote);
  const nextDownvotesUsed =
    downvotesUsed -
    Math.abs(Math.min(0, currentVote)) +
    Math.abs(Math.min(0, nextVote));

  if (delta === 1 && nextUpvotesUsed > maxUp) {
    return {
      nextVote,
      nextUpvotesUsed,
      nextDownvotesUsed,
      errorCode: "no_upvotes_remaining",
    };
  }

  if (delta === -1 && nextDownvotesUsed > maxDown) {
    return {
      nextVote,
      nextUpvotesUsed,
      nextDownvotesUsed,
      errorCode: "no_downvotes_remaining",
    };
  }

  return {
    nextVote,
    nextUpvotesUsed,
    nextDownvotesUsed,
    errorCode: null,
  };
}

export function getVoteStepErrorMessage(errorCode: VoteStepErrorCode): string {
  switch (errorCode) {
    case "max_upvotes_per_submission":
      return "You have reached the maximum number of upvotes for this song.";
    case "max_downvotes_per_submission":
      return "You have reached the maximum number of downvotes for this song.";
    case "no_upvotes_remaining":
      return "No upvotes remaining.";
    case "no_downvotes_remaining":
      return "No downvotes remaining.";
  }
}
