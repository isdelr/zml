import { z } from "zod";

import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_MB,
  MAX_SONG_SIZE_BYTES,
  MAX_SONG_SIZE_MB,
} from "@/lib/submission/constants";
import { isYouTubeLink } from "@/lib/youtube";

export const multiTrackSchema = z.object({
  songTitle: z.string().min(1, "Track title is required"),
  artist: z.string().min(1, "Artist is required"),
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
});

export const multiSongSubmissionFormSchema = z
  .object({
    submissionType: z.enum(["manual", "link"]),
    tracks: z.array(multiTrackSchema).min(1, "At least one track is required"),
  })
  .refine(
    (data) => {
      if (data.submissionType === "manual") {
        return data.tracks.every(
          (track) =>
            track.songFile &&
            track.songFile.size > 0 &&
            track.albumArtFile &&
            track.albumArtFile.size > 0,
        );
      }
      if (data.submissionType === "link") {
        return data.tracks.every(
          (track) => track.songLink && isYouTubeLink(track.songLink),
        );
      }
      return false;
    },
    {
      message: "Please complete all required fields for your chosen submission type.",
      path: ["submissionType"],
    },
  );

export type MultiSongSubmissionFormInput = z.input<
  typeof multiSongSubmissionFormSchema
>;
export type MultiSongSubmissionFormOutput = z.output<
  typeof multiSongSubmissionFormSchema
>;

export const defaultMultiSongSubmissionFormValues: MultiSongSubmissionFormInput = {
  submissionType: "manual",
  tracks: [{ songTitle: "", artist: "", comment: "" }],
};

export function createDefaultMultiTrack(): MultiSongSubmissionFormInput["tracks"][number] {
  return {
    songTitle: "",
    artist: "",
    comment: "",
  };
}
