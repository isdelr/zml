import { z } from "zod";

import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_MB,
  MAX_SONG_SIZE_BYTES,
  MAX_SONG_SIZE_MB,
} from "@/lib/submission/constants";
import { extractYouTubeVideoId } from "@/lib/youtube";

export const songSubmissionFormSchema = z
  .object({
    submissionType: z.enum(["manual", "link"]),
    songTitle: z.string().optional(),
    artist: z.string().optional(),
    albumName: z.string().optional(),
    year: z.number().optional(),
    albumArtFile: z
      .instanceof(File)
      .optional()
      .refine(
        (file) => !file || file.size <= MAX_IMAGE_SIZE_BYTES,
        `Max image size is ${MAX_IMAGE_SIZE_MB}MB.`,
      ),
    songFile: z
      .instanceof(File)
      .optional()
      .refine(
        (file) => !file || file.size <= MAX_SONG_SIZE_BYTES,
        `Max song size is ${MAX_SONG_SIZE_MB}MB.`,
      ),
    songLink: z.string().optional(),
    comment: z.string().optional(),
    duration: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.submissionType === "manual") {
      let hasMissingManualRequirement = false;

      if (!data.songTitle?.trim()) {
        hasMissingManualRequirement = true;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Song title is required.",
          path: ["songTitle"],
        });
      }

      if (!data.artist?.trim()) {
        hasMissingManualRequirement = true;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Artist is required.",
          path: ["artist"],
        });
      }

      if (!data.songFile?.size) {
        hasMissingManualRequirement = true;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Song file is required.",
          path: ["songFile"],
        });
      }

      if (!data.albumArtFile?.size) {
        hasMissingManualRequirement = true;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Album art is required.",
          path: ["albumArtFile"],
        });
      }

      if (hasMissingManualRequirement) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please complete the required fields for your chosen submission type.",
          path: ["submissionType"],
        });
      }
    }

    if (data.submissionType === "link") {
      if (!extractYouTubeVideoId(data.songLink)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please provide a valid YouTube link.",
          path: ["songLink"],
        });
      }
    }
  });

export type SongSubmissionFormValues = z.infer<typeof songSubmissionFormSchema>;

export const defaultSongSubmissionFormValues: SongSubmissionFormValues = {
  submissionType: "manual",
  songTitle: "",
  artist: "",
  albumName: "",
  year: undefined,
  songLink: "",
  comment: "",
};
