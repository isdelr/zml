import { describe, expect, it } from "vitest";

import {
  getSubmissionCompletionCountsByUser,
  getUserSubmissionCompletionCount,
} from "@/lib/rounds/submission-completion";

describe("submission completion helpers", () => {
  it("counts multi-track submissions by track even within one collection", () => {
    const submissions = [
      { userId: "u1", collectionId: "mix-1" },
      { userId: "u1", collectionId: "mix-1" },
      { userId: "u2", collectionId: "mix-2" },
    ];

    expect(getSubmissionCompletionCountsByUser(submissions, "multi")).toEqual(
      new Map([
        ["u1", 2],
        ["u2", 1],
      ]),
    );
  });

  it("counts album submissions by distinct collection id", () => {
    const submissions = [
      { userId: "u1", collectionId: "album-1" },
      { userId: "u1", collectionId: "album-1" },
      { userId: "u1", collectionId: "album-2" },
    ];

    expect(getUserSubmissionCompletionCount(submissions, "album", "u1")).toBe(
      2,
    );
  });

  it("falls back to row counting for album submissions without a collection id", () => {
    const submissions = [
      { userId: "u1", collectionId: "album-1" },
      { userId: "u1", collectionId: "album-1" },
      { userId: "u1", collectionId: null },
    ];

    expect(getUserSubmissionCompletionCount(submissions, "album", "u1")).toBe(
      2,
    );
  });
});
