import { z } from "zod";

import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_MB,
  MAX_SONG_SIZE_BYTES,
  MAX_SONG_SIZE_MB,
} from "@/lib/submission/constants";
import { isYouTubeLink } from "@/lib/youtube";

export const songSubmissionFormSchema = z
  .object({
    submissionType: z.enum(["manual", "link"]),
    songTitle: z.string().optional(),
    artist: z.string().optional(),
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
  .refine(
    (data) => {
      if (data.submissionType === "manual") {
        return (
          data.songTitle &&
          data.artist &&
          data.albumArtFile?.size &&
          data.songFile?.size
        );
      }
      if (data.submissionType === "link") {
        return isYouTubeLink(data.songLink);
      }
      return false;
    },
    {
      message: "Please complete the required fields for your chosen submission type.",
      path: ["submissionType"],
    },
  );

export type SongSubmissionFormValues = z.infer<typeof songSubmissionFormSchema>;

export const defaultSongSubmissionFormValues: SongSubmissionFormValues = {
  submissionType: "manual",
  songTitle: "",
  artist: "",
  songLink: "",
  comment: "",
};
