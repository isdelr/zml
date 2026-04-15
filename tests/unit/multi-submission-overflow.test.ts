import { describe, expect, it } from "vitest";

import { getOverflowMultiRoundSubmissionIds } from "@/lib/rounds/multi-submission-overflow";

describe("getOverflowMultiRoundSubmissionIds", () => {
  it("keeps each user's earliest allowed tracks and marks later ones as overflow", () => {
    expect(
      getOverflowMultiRoundSubmissionIds(
        [
          {
            _id: "submission-1",
            userId: "user-1",
            _creationTime: 10,
          },
          {
            _id: "submission-2",
            userId: "user-1",
            _creationTime: 20,
          },
          {
            _id: "submission-3",
            userId: "user-1",
            _creationTime: 30,
          },
          {
            _id: "submission-4",
            userId: "user-2",
            _creationTime: 15,
          },
        ],
        2,
      ),
    ).toEqual(["submission-3"]);
  });

  it("uses the submission id as a stable tiebreaker when creation times match", () => {
    expect(
      getOverflowMultiRoundSubmissionIds(
        [
          {
            _id: "submission-b",
            userId: "user-1",
            _creationTime: 10,
          },
          {
            _id: "submission-a",
            userId: "user-1",
            _creationTime: 10,
          },
        ],
        1,
      ),
    ).toEqual(["submission-b"]);
  });

  it("returns no overflow ids when all users are within the limit", () => {
    expect(
      getOverflowMultiRoundSubmissionIds(
        [
          {
            _id: "submission-1",
            userId: "user-1",
            _creationTime: 10,
          },
          {
            _id: "submission-2",
            userId: "user-2",
            _creationTime: 20,
          },
        ],
        2,
      ),
    ).toEqual([]);
  });
});
