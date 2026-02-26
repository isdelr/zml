import { z } from "zod";

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

const roundSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  submissionsPerUser: z.coerce.number().min(1, "Must be at least 1.").max(5, "Max 5 submissions."),
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
    submissionDeadline: z.coerce
      .number()
      .min(1, "Must be at least 1 hour.")
      .max(720, "Max duration is 30 days (720 hours)."),
    votingDeadline: z.coerce
      .number()
      .min(1, "Must be at least 1 hour.")
      .max(720, "Max duration is 30 days (720 hours)."),
    maxPositiveVotes: z.coerce.number().min(1, "Must be at least 1 vote."),
    maxNegativeVotes: z.coerce.number().min(0, "Cannot be negative."),
    limitVotesPerSubmission: z.boolean().default(false),
    maxPositiveVotesPerSubmission: z.coerce.number().min(1, "Must be at least 1 vote.").optional(),
    maxNegativeVotesPerSubmission: z.coerce.number().min(0, "Cannot be negative.").optional(),
    enforceListenPercentage: z.boolean().default(false),
    listenPercentage: z.coerce
      .number()
      .min(1, "Must be between 1-100%")
      .max(100, "Must be between 1-100%")
      .optional(),
    listenTimeLimitMinutes: z.coerce.number().min(1, "Must be at least 1 minute.").optional(),
    rounds: z.array(roundSchema).min(1, "You must add at least one round."),
  })
  .superRefine((data, ctx) => {
    if (data.enforceListenPercentage) {
      if (data.listenPercentage === undefined || Number.isNaN(data.listenPercentage)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A percentage is required.",
          path: ["listenPercentage"],
        });
      }
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
  submissionDeadline: 168,
  votingDeadline: 72,
  maxPositiveVotes: 5,
  maxNegativeVotes: 1,
  limitVotesPerSubmission: false,
  enforceListenPercentage: false,
  rounds: [createDefaultRound()],
};
