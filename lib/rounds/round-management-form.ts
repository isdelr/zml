import { z } from "zod";

const albumConfigSchema = z
  .object({
    allowPartial: z.boolean().optional(),
    requireReleaseYear: z.boolean().optional(),
    minTracks: z.coerce.number().min(1, "Must be at least 1 track.").optional(),
    maxTracks: z.coerce.number().min(1, "Must be at least 1 track.").optional(),
  })
  .optional();

export const roundManagementSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters."),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters."),
    submissionsPerUser: z.coerce
      .number()
      .min(1, "Must be at least 1.")
      .max(5, "Max 5 submissions."),
    genres: z.array(z.string()).default([]),
    submissionMode: z.enum(["single", "multi", "album"]).default("single"),
    submissionInstructions: z.string().optional(),
    albumConfig: albumConfigSchema,
  })
  .superRefine((data, ctx) => {
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
    albumConfig: {
      allowPartial: false,
      requireReleaseYear: true,
      minTracks: undefined,
      maxTracks: undefined,
    },
  };
}
