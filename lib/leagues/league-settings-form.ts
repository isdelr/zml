import { z } from "zod";

export const leagueEditSchema = z
  .object({
    name: z.string().min(3, "Name must be at least 3 characters."),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters."),
    isPublic: z.boolean(),
    submissionDeadline: z.coerce
      .number()
      .min(1, "Must be at least 1 hour.")
      .max(720, "Max duration is 30 days (720 hours)."),
    votingDeadline: z.coerce
      .number()
      .min(1, "Must be at least 1 hour.")
      .max(720, "Max duration is 30 days (720 hours)."),
    maxPositiveVotes: z.coerce.number().min(1),
    maxNegativeVotes: z.coerce.number().min(0),
    limitVotesPerSubmission: z.boolean(),
    maxPositiveVotesPerSubmission: z.coerce.number().min(1).optional(),
    maxNegativeVotesPerSubmission: z.coerce.number().min(0).optional(),
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
