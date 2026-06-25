import { z } from "zod";
import {
  getDefaultNegativeVotesPerSubmission,
  getDefaultPositiveVotesPerSubmission,
  MAX_LEAGUE_DOWNVOTES_PER_MEMBER,
  MAX_LEAGUE_UPVOTES_PER_MEMBER,
} from "@/lib/leagues/vote-limits";
import {
  getSubmissionSettingsError,
  MAX_SUBMISSIONS_PER_USER,
} from "@/lib/rounds/submission-settings";
import {
  DEFAULT_SUBMISSION_DURATION_MINUTES,
  DEFAULT_VOTING_DURATION_MINUTES,
  MIN_ROUND_DURATION_MINUTES,
  formatDurationMinutes,
} from "@/lib/time/duration";

export const MAX_ROUND_IMAGE_SIZE_MB = 5;
export const MAX_ROUND_IMAGE_SIZE_BYTES = MAX_ROUND_IMAGE_SIZE_MB * 1024 * 1024;

const albumConfigSchema = z
  .object({
    allowPartial: z.boolean().optional(),
    requireReleaseYear: z.boolean().optional(),
    minTracks: z.coerce.number().min(1, "Must be at least 1 track.").optional(),
    maxTracks: z.coerce.number().min(1, "Must be at least 1 track.").optional(),
  })
  .optional();

const durationMinutesSchema = z.coerce
  .number()
  .int("Must be a whole number of minutes.")
  .min(
    MIN_ROUND_DURATION_MINUTES,
    `Must be at least ${formatDurationMinutes(MIN_ROUND_DURATION_MINUTES)}.`,
  );

const roundSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  submissionsPerUser: z.coerce
    .number()
    .int("Must be a whole number.")
    .min(1, "Must be at least 1.")
    .max(
      MAX_SUBMISSIONS_PER_USER,
      `Max ${MAX_SUBMISSIONS_PER_USER} submissions.`,
    ),
  genres: z.array(z.string()).optional(),
  imageFile: z
    .instanceof(File)
    .optional()
    .refine(
      (file) => !file || file.size <= MAX_ROUND_IMAGE_SIZE_BYTES,
      `Image must be less than ${MAX_ROUND_IMAGE_SIZE_MB}MB.`,
    ),
  submissionMode: z.enum(["single", "multi", "album"]).default("single"),
  submissionInstructions: z.string().optional(),
  submissionDurationMinutes: durationMinutesSchema.optional(),
  votingDurationMinutes: durationMinutesSchema.optional(),
  albumConfig: albumConfigSchema,
});

export const createLeagueFormSchema = z
  .object({
    name: z.string().min(3, {
      message: "League name must be at least 3 characters.",
    }),
    description: z.string().min(10, {
      message: "Description must be at least 10 characters.",
    }),
    isPublic: z.boolean().default(false),
    submissionDurationMinutes: durationMinutesSchema,
    votingDurationMinutes: durationMinutesSchema,
    maxPositiveVotes: z.coerce
      .number()
      .min(1, "Must be at least 1 vote.")
      .max(
        MAX_LEAGUE_UPVOTES_PER_MEMBER,
        `Cannot exceed ${MAX_LEAGUE_UPVOTES_PER_MEMBER} votes.`,
      ),
    maxNegativeVotes: z.coerce
      .number()
      .min(0, "Cannot be negative.")
      .max(
        MAX_LEAGUE_DOWNVOTES_PER_MEMBER,
        `Cannot exceed ${MAX_LEAGUE_DOWNVOTES_PER_MEMBER} votes.`,
      ),
    limitVotesPerSubmission: z.boolean().default(true),
    maxPositiveVotesPerSubmission: z.coerce.number().min(1, "Must be at least 1 vote.").optional(),
    maxNegativeVotesPerSubmission: z.coerce.number().min(1, "Must be at least 1 vote.").optional(),
    enforceListenPercentage: z.boolean().default(true),
    listenTimeLimitMinutes: z.coerce
      .number()
      .int("Must be a whole number of minutes.")
      .min(1, "Must be at least 1 minute.")
      .optional(),
    rounds: z.array(roundSchema).min(1, "You must add at least one round."),
  })
  .superRefine((data, ctx) => {
    if (data.enforceListenPercentage) {
      if (
        data.listenTimeLimitMinutes === undefined ||
        Number.isNaN(data.listenTimeLimitMinutes)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A time limit is required.",
          path: ["listenTimeLimitMinutes"],
        });
      }
    }
    if (data.limitVotesPerSubmission) {
      if (
        data.maxPositiveVotesPerSubmission === undefined ||
        Number.isNaN(data.maxPositiveVotesPerSubmission)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A max is required.",
          path: ["maxPositiveVotesPerSubmission"],
        });
      }
      if (
        data.maxNegativeVotesPerSubmission === undefined ||
        Number.isNaN(data.maxNegativeVotesPerSubmission)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A max is required.",
          path: ["maxNegativeVotesPerSubmission"],
        });
      }
    }

    data.rounds.forEach((round, index) => {
      const submissionSettingsError = getSubmissionSettingsError({
        submissionsPerUser: round.submissionsPerUser,
        submissionMode: round.submissionMode,
      });
      if (submissionSettingsError) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: submissionSettingsError,
          path: ["rounds", index, "submissionsPerUser"],
        });
      }

      if (round.submissionMode === "album" && round.albumConfig) {
        const { minTracks, maxTracks } = round.albumConfig;
        if (minTracks !== undefined && maxTracks !== undefined && minTracks > maxTracks) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Minimum tracks cannot exceed maximum tracks.",
            path: ["rounds", index, "albumConfig", "minTracks"],
          });
        }
      }
    });
  });

export type CreateLeagueFormValues = z.infer<typeof createLeagueFormSchema>;
export type CreateLeagueFormInput = z.input<typeof createLeagueFormSchema>;

export function createDefaultRound(): CreateLeagueFormValues["rounds"][number] {
  return {
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
  };
}

export const defaultCreateLeagueFormValues: CreateLeagueFormValues = {
  name: "",
  description: "",
  isPublic: false,
  submissionDurationMinutes: DEFAULT_SUBMISSION_DURATION_MINUTES,
  votingDurationMinutes: DEFAULT_VOTING_DURATION_MINUTES,
  maxPositiveVotes: 5,
  maxNegativeVotes: 1,
  limitVotesPerSubmission: true,
  maxPositiveVotesPerSubmission: getDefaultPositiveVotesPerSubmission(5),
  maxNegativeVotesPerSubmission: getDefaultNegativeVotesPerSubmission(1),
  enforceListenPercentage: true,
  listenTimeLimitMinutes: 15,
  rounds: [createDefaultRound()],
};
