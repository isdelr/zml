import { z } from "zod";

import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_MB,
  MAX_SONG_SIZE_BYTES,
  MAX_SONG_SIZE_MB,
} from "@/lib/submission/constants";
import { extractYouTubeVideoId } from "@/lib/youtube";

export const editSubmissionFormSchema = z
  .object({
    submissionType: z.enum(["file", "link"]),
    songTitle: z.string().min(1, { message: "Title is required." }),
    artist: z.string().min(1, { message: "Artist is required." }),
    albumName: z.string().optional(),
    year: z.number().optional(),
    comment: z.string().optional(),
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
    duration: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.submissionType === "link") {
      if (!data.songLink || data.songLink.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A YouTube link is required.",
          path: ["songLink"],
        });
      } else if (!extractYouTubeVideoId(data.songLink)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please provide a valid YouTube link.",
          path: ["songLink"],
        });
      }
    }
  });

export type EditSubmissionFormValues = z.infer<typeof editSubmissionFormSchema>;
