import { describe, expect, it } from "vitest";

import {
  getVotingEligibilityReason,
  getVotingParticipationSummary,
  getVotingRestrictionCopy,
} from "@/lib/rounds/voting-participation";

describe("voting participation helpers", () => {
  it("classifies late joiners separately from members who missed submission", () => {
    expect(
      getVotingEligibilityReason({
        hasSubmitted: false,
        joinDate: new Date("2026-03-20T12:00:00Z").getTime(),
        submissionDeadline: new Date("2026-03-20T00:00:00Z").getTime(),
      }),
    ).toBe("joined_late");

    expect(
      getVotingEligibilityReason({
        hasSubmitted: false,
        joinDate: new Date("2026-03-19T12:00:00Z").getTime(),
        submissionDeadline: new Date("2026-03-20T00:00:00Z").getTime(),
      }),
    ).toBe("missed_submission");
  });

  it("splits eligible voters from listening-only members in round summaries", () => {
    const summary = getVotingParticipationSummary({
      members: [
        { _id: "u1", name: "Submitted and voted" },
        { _id: "u2", name: "Submitted and pending" },
        { _id: "u3", name: "Missed submission" },
        {
          _id: "u4",
          name: "Joined late",
          joinDate: new Date("2026-03-21T00:00:00Z").getTime(),
        },
      ],
      submissions: [{ userId: "u1" }, { userId: "u2" }],
      finalizedVoterIds: ["u1"],
      submissionDeadline: new Date("2026-03-20T00:00:00Z").getTime(),
    });

    expect(summary.finalizedVoters.map((user) => user._id)).toEqual(["u1"]);
    expect(summary.pendingVoters.map((user) => user._id)).toEqual(["u2"]);
    expect(summary.listeningOnlyMembers.map((user) => user._id)).toEqual([
      "u3",
    ]);
    expect(summary.lateJoiners.map((user) => user._id)).toEqual(["u4"]);
  });

  it("returns user-facing copy for listen-only states", () => {
    expect(getVotingRestrictionCopy("missed_submission")).toMatchObject({
      title: "Listen-Only This Round",
      shortStatus: "Listen Only",
    });

    expect(getVotingRestrictionCopy("joined_late")).toMatchObject({
      title: "Round Already Underway",
      shortStatus: "Joined Late",
    });
  });
});
