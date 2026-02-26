import { describe, expect, it } from "vitest";

import {
  createDefaultRound,
  createLeagueFormSchema,
} from "@/lib/leagues/create-league-form";

function buildValidLeagueInput() {
  return {
    name: "My League",
    description: "A league description long enough.",
    isPublic: false,
    submissionDeadline: 168,
    votingDeadline: 72,
    maxPositiveVotes: 5,
    maxNegativeVotes: 1,
    limitVotesPerSubmission: false,
    enforceListenPercentage: false,
    rounds: [
      {
        title: "Round One",
        description: "Round description long enough.",
        submissionsPerUser: 1,
        genres: ["Rock"],
        submissionMode: "single" as const,
        submissionInstructions: "",
        albumConfig: {
          allowPartial: false,
          requireReleaseYear: true,
          minTracks: undefined,
          maxTracks: undefined,
        },
      },
    ],
  };
}

describe("createLeagueFormSchema", () => {
  it("creates expected default round structure", () => {
    expect(createDefaultRound()).toEqual({
      title: "",
      description: "",
      genres: [],
      submissionsPerUser: 1,
      submissionMode: "single",
      submissionInstructions: "",
      albumConfig: {
        allowPartial: false,
        requireReleaseYear: true,
        minTracks: undefined,
        maxTracks: undefined,
      },
    });
  });

  it("accepts a valid base league payload", () => {
    const result = createLeagueFormSchema.safeParse(buildValidLeagueInput());
    expect(result.success).toBe(true);
  });

  it("requires listen config when enforceListenPercentage is enabled", () => {
    const result = createLeagueFormSchema.safeParse({
      ...buildValidLeagueInput(),
      enforceListenPercentage: true,
      listenPercentage: undefined,
      listenTimeLimitMinutes: undefined,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("listenPercentage");
      expect(paths).toContain("listenTimeLimitMinutes");
    }
  });

  it("requires per-submission vote limits when that mode is enabled", () => {
    const result = createLeagueFormSchema.safeParse({
      ...buildValidLeagueInput(),
      limitVotesPerSubmission: true,
      maxPositiveVotesPerSubmission: undefined,
      maxNegativeVotesPerSubmission: undefined,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("maxPositiveVotesPerSubmission");
      expect(paths).toContain("maxNegativeVotesPerSubmission");
    }
  });

  it("rejects album rounds where minTracks exceeds maxTracks", () => {
    const result = createLeagueFormSchema.safeParse({
      ...buildValidLeagueInput(),
      rounds: [
        {
          ...buildValidLeagueInput().rounds[0],
          submissionMode: "album",
          albumConfig: {
            allowPartial: false,
            requireReleaseYear: true,
            minTracks: 4,
            maxTracks: 2,
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("rounds.0.albumConfig.minTracks");
    }
  });
});
