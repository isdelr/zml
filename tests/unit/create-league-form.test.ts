import { describe, expect, it } from "vitest";

import {
  createDefaultRound,
  createLeagueFormSchema,
  defaultCreateLeagueFormValues,
} from "@/lib/leagues/create-league-form";
import {
  getDefaultNegativeVotesPerSubmission,
  getDefaultPositiveVotesPerSubmission,
  MAX_LEAGUE_DOWNVOTES_PER_MEMBER,
  MAX_LEAGUE_UPVOTES_PER_MEMBER,
} from "@/lib/leagues/vote-limits";
import { MAX_SUBMISSIONS_PER_USER } from "@/lib/rounds/submission-settings";

function buildValidLeagueInput() {
  return {
    name: "My League",
    description: "A league description long enough.",
    isPublic: false,
    submissionDurationMinutes: 168 * 60,
    votingDurationMinutes: 72 * 60,
    maxPositiveVotes: 5,
    maxNegativeVotes: 1,
    limitVotesPerSubmission: true,
    maxPositiveVotesPerSubmission: getDefaultPositiveVotesPerSubmission(5),
    maxNegativeVotesPerSubmission: getDefaultNegativeVotesPerSubmission(1),
    enforceListenPercentage: true,
    listenTimeLimitMinutes: 15,
    rounds: [
      {
        title: "Round One",
        description: "Round description long enough.",
        submissionsPerUser: 1,
        genres: ["Rock"],
        submissionMode: "single" as const,
        submissionInstructions: "",
        submissionDurationMinutes: undefined,
        votingDurationMinutes: undefined,
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
      submissionDurationMinutes: undefined,
      votingDurationMinutes: undefined,
      albumConfig: {
        allowPartial: false,
        requireReleaseYear: true,
        minTracks: undefined,
        maxTracks: undefined,
      },
    });
  });

  it("creates expected league rule defaults", () => {
    expect(defaultCreateLeagueFormValues.limitVotesPerSubmission).toBe(true);
    expect(defaultCreateLeagueFormValues.maxPositiveVotesPerSubmission).toBe(3);
    expect(defaultCreateLeagueFormValues.maxNegativeVotesPerSubmission).toBe(1);
    expect(defaultCreateLeagueFormValues.enforceListenPercentage).toBe(true);
    expect(defaultCreateLeagueFormValues.listenTimeLimitMinutes).toBe(15);
    expect(defaultCreateLeagueFormValues.submissionDurationMinutes).toBe(
      168 * 60,
    );
    expect(defaultCreateLeagueFormValues.votingDurationMinutes).toBe(72 * 60);
  });

  it("accepts a valid base league payload", () => {
    const result = createLeagueFormSchema.safeParse(buildValidLeagueInput());
    expect(result.success).toBe(true);
  });

  it("rejects round phase durations shorter than 10 minutes", () => {
    const result = createLeagueFormSchema.safeParse({
      ...buildValidLeagueInput(),
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

  it("accepts vote totals up to the configured cap", () => {
    const result = createLeagueFormSchema.safeParse({
      ...buildValidLeagueInput(),
      maxPositiveVotes: MAX_LEAGUE_UPVOTES_PER_MEMBER,
      maxNegativeVotes: MAX_LEAGUE_DOWNVOTES_PER_MEMBER,
    });

    expect(result.success).toBe(true);
  });

  it("rejects vote totals above the configured cap", () => {
    const result = createLeagueFormSchema.safeParse({
      ...buildValidLeagueInput(),
      maxPositiveVotes: MAX_LEAGUE_UPVOTES_PER_MEMBER + 1,
      maxNegativeVotes: MAX_LEAGUE_DOWNVOTES_PER_MEMBER + 1,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("maxPositiveVotes");
      expect(paths).toContain("maxNegativeVotes");
    }
  });

  it("accepts submissions per user up to the configured cap", () => {
    const result = createLeagueFormSchema.safeParse({
      ...buildValidLeagueInput(),
      rounds: [
        {
          ...buildValidLeagueInput().rounds[0],
          submissionsPerUser: MAX_SUBMISSIONS_PER_USER,
          submissionMode: "multi",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects submissions per user above the configured cap", () => {
    const result = createLeagueFormSchema.safeParse({
      ...buildValidLeagueInput(),
      rounds: [
        {
          ...buildValidLeagueInput().rounds[0],
          submissionsPerUser: MAX_SUBMISSIONS_PER_USER + 1,
          submissionMode: "multi",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("rounds.0.submissionsPerUser");
    }
  });

  it("rejects single-song mode with multiple songs per participant", () => {
    const result = createLeagueFormSchema.safeParse({
      ...buildValidLeagueInput(),
      rounds: [
        {
          ...buildValidLeagueInput().rounds[0],
          submissionsPerUser: 2,
          submissionMode: "single",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("rounds.0.submissionsPerUser");
    }
  });

  it("rejects multiple-song modes with one song per participant", () => {
    const result = createLeagueFormSchema.safeParse({
      ...buildValidLeagueInput(),
      rounds: [
        {
          ...buildValidLeagueInput().rounds[0],
          submissionsPerUser: 1,
          submissionMode: "multi",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("rounds.0.submissionsPerUser");
    }
  });

  it("requires protection time when listening enforcement is enabled", () => {
    const result = createLeagueFormSchema.safeParse({
      ...buildValidLeagueInput(),
      enforceListenPercentage: true,
      listenTimeLimitMinutes: undefined,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("listenTimeLimitMinutes");
    }
  });

  it("rejects fractional listen protection caps", () => {
    const result = createLeagueFormSchema.safeParse({
      ...buildValidLeagueInput(),
      listenTimeLimitMinutes: 1.5,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
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
          submissionsPerUser: 2,
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
