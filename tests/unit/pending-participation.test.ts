import { describe, expect, it } from "vitest";
import {
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
});
