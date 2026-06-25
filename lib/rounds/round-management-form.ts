import { z } from "zod";
import {
  getSubmissionSettingsError,
  MAX_SUBMISSIONS_PER_USER,
} from "@/lib/rounds/submission-settings";
import {
  MIN_ROUND_DURATION_MINUTES,
  formatDurationMinutes,
} from "@/lib/time/duration";

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

export const roundManagementSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters."),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters."),
    submissionsPerUser: z.coerce
      .number()
      .int("Must be a whole number.")
      .min(1, "Must be at least 1.")
      .max(
        MAX_SUBMISSIONS_PER_USER,
        `Max ${MAX_SUBMISSIONS_PER_USER} submissions.`,
      ),
    genres: z.array(z.string()).default([]),
    submissionMode: z.enum(["single", "multi", "album"]).default("single"),
    submissionInstructions: z.string().optional(),
    submissionDurationMinutes: durationMinutesSchema.optional(),
    votingDurationMinutes: durationMinutesSchema.optional(),
    albumConfig: albumConfigSchema,
  })
  .superRefine((data, ctx) => {
    const submissionSettingsError = getSubmissionSettingsError({
      submissionsPerUser: data.submissionsPerUser,
      submissionMode: data.submissionMode,
    });
    if (submissionSettingsError) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: submissionSettingsError,
        path: ["submissionsPerUser"],
      });
    }

    if (data.submissionMode !== "album" || !data.albumConfig) {
      return;
    }

    const { minTracks, maxTracks } = data.albumConfig;
    if (
      minTracks !== undefined &&
      maxTracks !== undefined &&
      minTracks > maxTracks
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum tracks cannot exceed maximum tracks.",
        path: ["albumConfig", "minTracks"],
      });
    }
  });

export type RoundManagementInput = z.input<typeof roundManagementSchema>;
export type RoundManagementValues = z.output<typeof roundManagementSchema>;

export function createDefaultRoundManagementValues(): RoundManagementValues {
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
