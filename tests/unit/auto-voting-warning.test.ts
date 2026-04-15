import { describe, expect, it } from "vitest";
import { willSubmissionImmediatelyStartVoting } from "@/lib/rounds/auto-voting-warning";

describe("willSubmissionImmediatelyStartVoting", () => {
  it("warns when the current user is the last remaining required submitter", () => {
    expect(
      willSubmissionImmediatelyStartVoting({
        roundStatus: "submissions",
        isFirstRound: false,
        submissionMode: "single",
        submissionsPerUser: 1,
        activeMemberCount: 3,
        currentUserId: "u3",
        submissions: [{ userId: "u1" }, { userId: "u2" }],
        additionalSubmissionUnits: 1,
        hasIncompleteFileSubmissions: false,
      }),
    ).toBe(true);
  });

  it("does not warn for first rounds", () => {
    expect(
      willSubmissionImmediatelyStartVoting({
        roundStatus: "submissions",
        isFirstRound: true,
        submissionMode: "single",
        submissionsPerUser: 1,
        activeMemberCount: 2,
        currentUserId: "u2",
        submissions: [{ userId: "u1" }],
        additionalSubmissionUnits: 1,
        hasIncompleteFileSubmissions: false,
      }),
    ).toBe(false);
  });

  it("does not warn while file submissions are still processing", () => {
    expect(
      willSubmissionImmediatelyStartVoting({
        roundStatus: "submissions",
        isFirstRound: false,
        submissionMode: "single",
        submissionsPerUser: 1,
        activeMemberCount: 2,
        currentUserId: "u2",
        submissions: [{ userId: "u1" }],
        additionalSubmissionUnits: 1,
        hasIncompleteFileSubmissions: true,
      }),
    ).toBe(false);
  });

  it("handles collection-based rounds by collection count", () => {
    expect(
      willSubmissionImmediatelyStartVoting({
        roundStatus: "submissions",
        isFirstRound: false,
        submissionMode: "album",
        submissionsPerUser: 2,
        activeMemberCount: 2,
        currentUserId: "u2",
        submissions: [
          { userId: "u1", collectionId: "album-a" },
          { userId: "u1", collectionId: "album-b" },
          { userId: "u2", collectionId: "album-c" },
          { userId: "u2", collectionId: "album-c" },
        ],
        additionalSubmissionUnits: 1,
        hasIncompleteFileSubmissions: false,
      }),
    ).toBe(true);
  });

  it("handles multi rounds by track count even when tracks share a collection", () => {
    expect(
      willSubmissionImmediatelyStartVoting({
        roundStatus: "submissions",
        isFirstRound: false,
        submissionMode: "multi",
        submissionsPerUser: 2,
        activeMemberCount: 2,
        currentUserId: "u2",
        submissions: [
          { userId: "u1" },
          { userId: "u1" },
          { userId: "u2", collectionId: "mix-a" },
        ],
        additionalSubmissionUnits: 1,
        hasIncompleteFileSubmissions: false,
      }),
    ).toBe(true);
  });
});
