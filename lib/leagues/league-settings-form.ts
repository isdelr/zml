import { z } from "zod";
import {
  MIN_ROUND_DURATION_MINUTES,
  formatDurationMinutes,
} from "@/lib/time/duration";

const durationMinutesSchema = z.coerce
  .number()
  .int("Must be a whole number of minutes.")
  .min(
    MIN_ROUND_DURATION_MINUTES,
    `Must be at least ${formatDurationMinutes(MIN_ROUND_DURATION_MINUTES)}.`,
  );

export const leagueEditSchema = z
  .object({
    name: z.string().min(3, "Name must be at least 3 characters."),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters."),
    isPublic: z.boolean(),
    submissionDurationMinutes: durationMinutesSchema,
    votingDurationMinutes: durationMinutesSchema,
    maxPositiveVotes: z.coerce.number().min(1),
    maxNegativeVotes: z.coerce.number().min(0),
    limitVotesPerSubmission: z.boolean(),
    maxPositiveVotesPerSubmission: z.coerce.number().min(1).optional(),
    maxNegativeVotesPerSubmission: z.coerce.number().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.limitVotesPerSubmission) {
      if (
        data.maxPositiveVotesPerSubmission === undefined ||
        isNaN(data.maxPositiveVotesPerSubmission)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A max is required.",
          path: ["maxPositiveVotesPerSubmission"],
        });
      }
      if (
        data.maxNegativeVotesPerSubmission === undefined ||
        isNaN(data.maxNegativeVotesPerSubmission)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A max is required.",
          path: ["maxNegativeVotesPerSubmission"],
        });
      }
    }
  });

export type LeagueEditInput = z.input<typeof leagueEditSchema>;
export type LeagueEditOutput = z.output<typeof leagueEditSchema>;
