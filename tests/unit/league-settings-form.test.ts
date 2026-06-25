import { describe, expect, it } from "vitest";

import { leagueEditSchema } from "@/lib/leagues/league-settings-form";

function buildValidLeagueEditInput() {
  return {
    name: "Updated League",
    description: "An updated league description that is long enough.",
    isPublic: true,
    submissionDurationMinutes: 168 * 60,
    votingDurationMinutes: 72 * 60,
    maxPositiveVotes: 5,
    maxNegativeVotes: 1,
    limitVotesPerSubmission: false,
  };
}

describe("leagueEditSchema", () => {
  it("accepts a valid base payload", () => {
    const result = leagueEditSchema.safeParse(buildValidLeagueEditInput());
    expect(result.success).toBe(true);
  });

  it("rejects phase durations shorter than 10 minutes", () => {
    const result = leagueEditSchema.safeParse({
      ...buildValidLeagueEditInput(),
      submissionDurationMinutes: 9,
      votingDurationMinutes: 9,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("submissionDurationMinutes");
      expect(paths).toContain("votingDurationMinutes");
    }
  });

  it("requires per-submission vote limits when that mode is enabled", () => {
    const result = leagueEditSchema.safeParse({
      ...buildValidLeagueEditInput(),
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

  it("accepts per-submission vote limits when enabled", () => {
    const result = leagueEditSchema.safeParse({
      ...buildValidLeagueEditInput(),
      limitVotesPerSubmission: true,
      maxPositiveVotesPerSubmission: 2,
      maxNegativeVotesPerSubmission: 1,
    });

    expect(result.success).toBe(true);
  });

  it("rejects zero per-submission downvote limits when enabled", () => {
    const result = leagueEditSchema.safeParse({
      ...buildValidLeagueEditInput(),
      limitVotesPerSubmission: true,
      maxPositiveVotesPerSubmission: 2,
      maxNegativeVotesPerSubmission: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("maxNegativeVotesPerSubmission");
    }
  });
});
