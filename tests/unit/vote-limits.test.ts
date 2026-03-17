import { describe, expect, it } from "vitest";

import {
  getVoteLimits,
  getVoteLimitSnapshotPatch,
} from "@/lib/convex-server/voteLimits";

describe("vote limit helpers", () => {
  it("falls back to league defaults when a round has no overrides", () => {
    expect(
      getVoteLimits(
        {
          maxPositiveVotes: null,
          maxNegativeVotes: undefined,
        },
        {
          maxPositiveVotes: 10,
          maxNegativeVotes: 3,
        },
      ),
    ).toEqual({
      maxUp: 10,
      maxDown: 3,
    });
  });

  it("snapshots both limits from league defaults when a round enters voting without overrides", () => {
    expect(
      getVoteLimitSnapshotPatch(
        {
          maxPositiveVotes: null,
          maxNegativeVotes: undefined,
        },
        {
          maxPositiveVotes: 16,
          maxNegativeVotes: 4,
        },
      ),
    ).toEqual({
      maxPositiveVotes: 16,
      maxNegativeVotes: 4,
    });
  });

  it("only snapshots the missing side when a round already has a partial override", () => {
    expect(
      getVoteLimitSnapshotPatch(
        {
          maxPositiveVotes: 8,
          maxNegativeVotes: null,
        },
        {
          maxPositiveVotes: 16,
          maxNegativeVotes: 4,
        },
      ),
    ).toEqual({
      maxNegativeVotes: 4,
    });
  });

  it("does not overwrite explicit per-round vote limits", () => {
    expect(
      getVoteLimitSnapshotPatch(
        {
          maxPositiveVotes: 8,
          maxNegativeVotes: 2,
        },
        {
          maxPositiveVotes: 16,
          maxNegativeVotes: 4,
        },
      ),
    ).toEqual({});
  });
});
