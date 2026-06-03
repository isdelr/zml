import { describe, expect, it } from "vitest";
import {
  getEffectiveStandardVoteScore,
  getEffectiveStandardVoteTotal,
  getFinalizedVoterIdSet,
  isSubmissionPenalized,
} from "@/lib/rounds/effective-votes";

describe("effective finished-round votes", () => {
  const submissions = {
    alice: { userId: "alice" },
    bob: { userId: "bob" },
    troll: { userId: "alice", isTrollSubmission: true },
  };

  it("only treats exact complete vote budgets as finalized", () => {
    const finalized = getFinalizedVoterIdSet(
      [
        { userId: "alice", vote: 2 },
        { userId: "alice", vote: -1 },
        { userId: "bob", vote: 2 },
        { userId: "bob", vote: -1 },
        { userId: "carol", vote: 1 },
        { userId: "carol", vote: -1 },
      ],
      2,
      1,
    );

    expect([...finalized].sort()).toEqual(["alice", "bob"]);
  });

  it("counts positives from finalized voters for eligible submissions", () => {
    const finalized = new Set(["alice", "bob"]);

    expect(
      getEffectiveStandardVoteTotal(
        [
          { userId: "alice", vote: 2 },
          { userId: "bob", vote: -1 },
        ],
        submissions.bob,
        finalized,
      ),
    ).toBe(1);
  });

  it("ignores positives from voters who missed the deadline", () => {
    const finalized = new Set(["alice"]);

    expect(
      getEffectiveStandardVoteScore(
        { userId: "carol", vote: 2 },
        submissions.bob,
        finalized,
      ),
    ).toBe(0);
  });

  it("still counts negatives from voters who missed the deadline", () => {
    const finalized = new Set(["alice"]);

    expect(
      getEffectiveStandardVoteScore(
        { userId: "carol", vote: -1 },
        submissions.bob,
        finalized,
      ),
    ).toBe(-1);
  });

  it("ignores positives on missed-submitter and troll submissions", () => {
    const finalized = new Set(["alice"]);

    expect(isSubmissionPenalized(submissions.bob, finalized)).toBe(true);
    expect(
      getEffectiveStandardVoteTotal(
        [
          { userId: "alice", vote: 2 },
          { userId: "carol", vote: -1 },
        ],
        submissions.bob,
        finalized,
      ),
    ).toBe(-1);
    expect(
      getEffectiveStandardVoteScore(
        { userId: "alice", vote: 2 },
        submissions.troll,
        finalized,
      ),
    ).toBe(0);
  });
});
