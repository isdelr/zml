import { describe, expect, it } from "vitest";

import { calculateVoteStep } from "@/lib/rounds/vote-step";

describe("calculateVoteStep", () => {
  it("allows removing an upvote without consuming a downvote", () => {
    const result = calculateVoteStep({
      currentVote: 2,
      delta: -1,
      upvotesUsed: 2,
      downvotesUsed: 0,
      maxUp: 2,
      maxDown: 0,
      limitVotesPerSubmission: true,
      maxPositiveVotesPerSubmission: 2,
      maxNegativeVotesPerSubmission: 0,
    });

    expect(result).toEqual({
      nextVote: 1,
      nextUpvotesUsed: 1,
      nextDownvotesUsed: 0,
      errorCode: null,
    });
  });

  it("blocks new downvotes when per-song downvotes are disabled", () => {
    const result = calculateVoteStep({
      currentVote: 0,
      delta: -1,
      upvotesUsed: 0,
      downvotesUsed: 0,
      maxUp: 2,
      maxDown: 0,
      limitVotesPerSubmission: true,
      maxPositiveVotesPerSubmission: 2,
      maxNegativeVotesPerSubmission: 0,
    });

    expect(result.errorCode).toBe("max_downvotes_per_submission");
  });
});
