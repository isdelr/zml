import { describe, expect, it } from "vitest";

import {
  EXTENSION_POLL_APPROVED_EXTENSION_MS,
  EXTENSION_POLL_MIN_TURNOUT_RATIO,
  EXTENSION_POLL_TIE_EXTENSION_MS,
  EXTENSION_REQUEST_WINDOW_RATIO,
  MAX_EXTENSION_REQUESTS_PER_LEAGUE_USER,
  formatExtensionPollRequestWindowLabel,
  getExtensionPollResolution,
  getExtensionPollMinimumTurnout,
  getExtensionPollRequestWindowMs,
  getFinalizedVotingParticipantIds,
  getRemainingExtensionRequests,
  hasExtensionPollReachedMinimumTurnout,
  isExtensionPollRequestWindowOpen,
} from "@/lib/rounds/extension-polls";

describe("extension poll helpers", () => {
  it("accepts only the final 25% of the voting window", () => {
    const now = new Date("2026-04-03T12:00:00Z").getTime();
    const votingStartsAt = now - 3 * 24 * 60 * 60 * 1000;
    const votingDeadline = now + 24 * 60 * 60 * 1000;

    expect(EXTENSION_REQUEST_WINDOW_RATIO).toBe(0.25);
    expect(
      getExtensionPollRequestWindowMs(votingStartsAt, votingDeadline),
    ).toBe(24 * 60 * 60 * 1000);
    expect(isExtensionPollRequestWindowOpen(votingStartsAt, votingDeadline, now)).toBe(
      true,
    );
    expect(
      isExtensionPollRequestWindowOpen(
        votingStartsAt,
        votingDeadline + 1,
        now,
      ),
    ).toBe(false);
    expect(isExtensionPollRequestWindowOpen(votingStartsAt, votingDeadline, votingDeadline)).toBe(
      false,
    );
  });

  it("formats extension request windows with concrete durations", () => {
    expect(formatExtensionPollRequestWindowLabel(24 * 60 * 60 * 1000)).toBe(
      "1 day",
    );
    expect(
      formatExtensionPollRequestWindowLabel(
        2 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000,
      ),
    ).toBe("2 days 6 hours");
    expect(formatExtensionPollRequestWindowLabel(90 * 60 * 1000)).toBe(
      "1 hour 30 minutes",
    );
  });

  it("tracks finalized voters from complete ballots only", () => {
    const members = [{ _id: "user-1" }, { _id: "user-2" }, { _id: "user-3" }];
    const submissions = [
      { userId: "user-1" },
      { userId: "user-2" },
      { userId: "user-3" },
    ];
    const votes = [
      { userId: "user-1", vote: 1 },
      { userId: "user-1", vote: 1 },
      { userId: "user-1", vote: -1 },
      { userId: "user-2", vote: 1 },
      { userId: "user-2", vote: 1 },
      { userId: "user-3", vote: 1 },
      { userId: "user-3", vote: 1 },
      { userId: "user-3", vote: -1 },
    ];

    expect(
      getFinalizedVotingParticipantIds(members, submissions, votes, 2, 1),
    ).toEqual(["user-1", "user-3"]);
  });

  it("calculates remaining league-wide request attempts", () => {
    expect(getRemainingExtensionRequests(0)).toBe(
      MAX_EXTENSION_REQUESTS_PER_LEAGUE_USER,
    );
    expect(getRemainingExtensionRequests(1)).toBe(1);
    expect(getRemainingExtensionRequests(99)).toBe(0);
  });

  it("maps poll outcomes to the correct extension length", () => {
    expect(
      getExtensionPollResolution({
        yesVotes: 4,
        noVotes: 2,
        eligibleVoterCount: 10,
      }),
    ).toEqual({
      result: "approved",
      appliedExtensionMs: EXTENSION_POLL_APPROVED_EXTENSION_MS,
    });
    expect(
      getExtensionPollResolution({
        yesVotes: 3,
        noVotes: 3,
        eligibleVoterCount: 10,
      }),
    ).toEqual({
      result: "tie",
      appliedExtensionMs: EXTENSION_POLL_TIE_EXTENSION_MS,
    });
    expect(
      getExtensionPollResolution({
        yesVotes: 1,
        noVotes: 5,
        eligibleVoterCount: 10,
      }),
    ).toEqual({
      result: "rejected",
      appliedExtensionMs: 0,
    });
  });

  it("requires at least half of eligible voters for a valid poll result", () => {
    expect(EXTENSION_POLL_MIN_TURNOUT_RATIO).toBe(0.5);
    expect(getExtensionPollMinimumTurnout(1)).toBe(1);
    expect(getExtensionPollMinimumTurnout(3)).toBe(2);
    expect(getExtensionPollMinimumTurnout(6)).toBe(3);
    expect(hasExtensionPollReachedMinimumTurnout(1, 3)).toBe(false);
    expect(hasExtensionPollReachedMinimumTurnout(2, 3)).toBe(true);
    expect(
      getExtensionPollResolution({
        yesVotes: 1,
        noVotes: 0,
        eligibleVoterCount: 4,
      }),
    ).toEqual({
      result: "insufficient_turnout",
      appliedExtensionMs: 0,
    });
  });
});
