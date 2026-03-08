import { describe, expect, it } from "vitest";

import {
  formatVoteScore,
  groupVoteSummaryDetailsByScore,
} from "@/lib/rounds/vote-summary-display";

describe("vote summary display helpers", () => {
  it("groups identical scores together and sorts groups by score", () => {
    const groups = groupVoteSummaryDetailsByScore([
      {
        voterId: "u3",
        voterName: "Carla",
        voterImage: null,
        score: -1,
      },
      {
        voterId: "u2",
        voterName: "Bruno",
        voterImage: null,
        score: 2,
      },
      {
        voterId: "u1",
        voterName: "Ana",
        voterImage: null,
        score: 2,
      },
    ]);

    expect(groups).toEqual([
      {
        score: 2,
        users: [
          { _id: "u1", name: "Ana", image: null },
          { _id: "u2", name: "Bruno", image: null },
        ],
      },
      {
        score: -1,
        users: [{ _id: "u3", name: "Carla", image: null }],
      },
    ]);
  });

  it("formats positive scores with a leading plus sign", () => {
    expect(formatVoteScore(3)).toBe("+3");
    expect(formatVoteScore(-2)).toBe("-2");
  });
});
