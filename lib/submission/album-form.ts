import { z } from "zod";

import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_MB,
  MAX_SONG_SIZE_BYTES,
  MAX_SONG_SIZE_MB,
} from "@/lib/submission/constants";
import { isYouTubeLink } from "@/lib/youtube";

export const albumTrackSchema = z.object({
  trackNumber: z.number().min(1),
  songTitle: z.string().min(1, "Track title is required"),
  artist: z.string().optional(),
  albumArtFile: z.instanceof(File).optional(),
  songFile: z
    .instanceof(File)
    .optional()
    .refine(
      (file) => !file || file.size <= MAX_SONG_SIZE_BYTES,
      `Max song size is ${MAX_SONG_SIZE_MB}MB.`,
    ),
  songLink: z.string().optional(),
  duration: z.number().optional(),
});

export const albumSubmissionFormSchema = z
  .object({
    submissionType: z.enum(["manual", "link"]),
    albumName: z.string().min(1, "Album name is required"),
    albumArtist: z.string().min(1, "Album artist is required"),
    albumArtFile: z
      .instanceof(File)
      .optional()
      .refine(
        (file) => !file || file.size <= MAX_IMAGE_SIZE_BYTES,
        `Max image size is ${MAX_IMAGE_SIZE_MB}MB.`,
      ),
    releaseYear: z.coerce.number().optional(),
    albumNotes: z.string().optional(),
    tracks: z.array(albumTrackSchema).min(1, "At least one track is required"),
  })
  .refine(
    (data) => {
      if (data.submissionType === "manual") {
        return (
          data.tracks.every((track) => track.songFile && track.songFile.size > 0) &&
          data.albumArtFile &&
          data.albumArtFile.size > 0
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

export type AlbumSubmissionFormInput = z.input<typeof albumSubmissionFormSchema>;
export type AlbumSubmissionFormOutput = z.output<typeof albumSubmissionFormSchema>;

export const defaultAlbumSubmissionFormValues: AlbumSubmissionFormInput = {
  submissionType: "manual",
  albumName: "",
  albumArtist: "",
  releaseYear: undefined,
  albumNotes: "",
  tracks: [{ trackNumber: 1, songTitle: "", artist: "" }],
};

export function createDefaultAlbumTrack(trackNumber: number): AlbumSubmissionFormInput["tracks"][number] {
  return {
    trackNumber,
    songTitle: "",
    artist: "",
  };
}
