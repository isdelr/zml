import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { useRoundVoting } from "@/hooks/useRoundVoting";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

function createRound(overrides: Record<string, unknown> = {}) {
  return {
    _id: "round-1",
    maxPositiveVotes: 2,
    maxNegativeVotes: 0,
    ...overrides,
  } as never;
}

function createLeague(overrides: Record<string, unknown> = {}) {
  return {
    maxPositiveVotes: 2,
    maxNegativeVotes: 0,
    limitVotesPerSubmission: false,
    ...overrides,
  } as never;
}

function createVoteStatus(overrides: Record<string, unknown> = {}) {
  return {
    hasVoted: false,
    canVote: true,
    votes: [],
    upvotesUsed: 0,
    downvotesUsed: 0,
    ...overrides,
  } as never;
}

describe("useRoundVoting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows non-final votes even when finalization is blocked by listening", async () => {
    const castVote = vi.fn().mockResolvedValue({
      isFinal: false,
      message: "Vote saved.",
    });

    vi.mocked(useQuery).mockReturnValue(createVoteStatus());
    vi.mocked(useMutation).mockReturnValue({
      withOptimisticUpdate: vi.fn(() => castVote),
    } as never);

    const { result } = renderHook(() =>
      useRoundVoting({
        round: createRound(),
        league: createLeague(),
        currentUserId: "user-1" as never,
        canFinalizeVotes: false,
        finalizationBlockedReason:
          "Listen to the remaining songs before submitting your final vote.",
      }),
    );

    await act(async () => {
      result.current.handleVoteClick("submission-1" as never, 1);
    });

    await waitFor(() => {
      expect(castVote).toHaveBeenCalledWith({
        submissionId: "submission-1",
        delta: 1,
        confirmFinal: false,
      });
    });
    expect(toast.error).not.toHaveBeenCalled();
    expect(result.current.confirmationState.isOpen).toBe(false);
  });

  it("blocks the vote that would finalize while listening is still incomplete", async () => {
    const castVote = vi.fn().mockResolvedValue({
      isFinal: false,
      message: "Vote saved.",
    });
    const finalizationBlockedReason =
      "Listen to the remaining 2 songs before submitting your final vote.";

    vi.mocked(useQuery).mockReturnValue(createVoteStatus());
    vi.mocked(useMutation).mockReturnValue({
      withOptimisticUpdate: vi.fn(() => castVote),
    } as never);

    const { result } = renderHook(() =>
      useRoundVoting({
        round: createRound({ maxPositiveVotes: 1 }),
        league: createLeague({ maxPositiveVotes: 1 }),
        currentUserId: "user-1" as never,
        canFinalizeVotes: false,
        finalizationBlockedReason,
      }),
    );

    await act(async () => {
      result.current.handleVoteClick("submission-1" as never, 1);
    });

    expect(castVote).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(finalizationBlockedReason);
    expect(result.current.confirmationState.isOpen).toBe(false);
  });

  it("lets users step an upvote down without hitting downvote limits", async () => {
    const castVote = vi.fn().mockResolvedValue({
      isFinal: false,
      message: "Vote saved.",
    });

    vi.mocked(useQuery).mockReturnValue(
      createVoteStatus({
        votes: [
          {
            submissionId: "submission-1",
            vote: 2,
          },
        ],
        upvotesUsed: 2,
      }),
    );
    vi.mocked(useMutation).mockReturnValue({
      withOptimisticUpdate: vi.fn(() => castVote),
    } as never);

    const { result } = renderHook(() =>
      useRoundVoting({
        round: createRound(),
        league: createLeague({
          limitVotesPerSubmission: true,
          maxPositiveVotesPerSubmission: 2,
          maxNegativeVotesPerSubmission: 0,
        }),
        currentUserId: "user-1" as never,
      }),
    );

    await act(async () => {
      result.current.handleVoteClick("submission-1" as never, -1);
    });

    await waitFor(() => {
      expect(castVote).toHaveBeenCalledWith({
        submissionId: "submission-1",
        delta: -1,
        confirmFinal: false,
      });
    });
    expect(toast.error).not.toHaveBeenCalled();
  });
});
