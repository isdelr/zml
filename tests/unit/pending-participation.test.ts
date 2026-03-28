import { describe, expect, it } from "vitest";
import {
  getPendingRoundParticipantIds,
  getPendingSubmissionParticipantIds,
  getPendingVotingParticipantIds,
} from "@/lib/rounds/pending-participation";

describe("pending participation helpers", () => {
  it("returns members who still owe submissions", () => {
    expect(
      getPendingSubmissionParticipantIds(
        [{ _id: "u1" }, { _id: "u2" }, { _id: "u3" }],
        [{ userId: "u1" }, { userId: "u1" }, { userId: "u2" }],
        2,
      ),
    ).toEqual(["u2", "u3"]);
  });

  it("counts multi and album submissions by collection", () => {
    expect(
      getPendingSubmissionParticipantIds(
        [{ _id: "u1" }, { _id: "u2" }],
        [
          { userId: "u1", collectionId: "c1" },
          { userId: "u1", collectionId: "c1" },
          { userId: "u2", collectionId: "c2" },
        ],
        1,
        "multi",
      ),
    ).toEqual([]);

    expect(
      getPendingSubmissionParticipantIds(
        [{ _id: "u1" }, { _id: "u2" }],
        [
          { userId: "u1", collectionId: "album-1" },
          { userId: "u1", collectionId: "album-1" },
        ],
        1,
        "album",
      ),
    ).toEqual(["u2"]);
  });

  it("returns only eligible submitters who still need to finish voting", () => {
    expect(
      getPendingVotingParticipantIds(
        [{ _id: "u1" }, { _id: "u2" }, { _id: "u3" }, { _id: "u4" }],
        [{ userId: "u1" }, { userId: "u2" }, { userId: "u3" }],
        [
          { userId: "u1", vote: 1 },
          { userId: "u1", vote: -1 },
          { userId: "u2", vote: 1 },
        ],
        1,
        1,
      ),
    ).toEqual(["u2", "u3"]);
  });

  it("returns an empty list when nobody is eligible to vote yet", () => {
    expect(
      getPendingVotingParticipantIds(
        [{ _id: "u1" }, { _id: "u2" }],
        [],
        [],
        2,
        1,
      ),
    ).toEqual([]);
  });

  it("routes status-based reminders through the matching pending helper", () => {
    expect(
      getPendingRoundParticipantIds({
        status: "submissions",
        members: [{ _id: "u1" }, { _id: "u2" }],
        submissions: [{ userId: "u1" }],
        submissionsPerUser: 1,
        submissionMode: "single",
      }),
    ).toEqual(["u2"]);

    expect(
      getPendingRoundParticipantIds({
        status: "voting",
        members: [{ _id: "u1" }, { _id: "u2" }, { _id: "u3" }],
        submissions: [{ userId: "u1" }, { userId: "u2" }],
        submissionsPerUser: 1,
        votes: [{ userId: "u1", vote: 1 }],
        maxUp: 1,
        maxDown: 1,
      }),
    ).toEqual(["u1", "u2"]);
  });
});
