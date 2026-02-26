import { describe, expect, it } from "vitest";

import {
  albumSubmissionFormSchema,
  createDefaultAlbumTrack,
  defaultAlbumSubmissionFormValues,
} from "@/lib/submission/album-form";
import {
  createDefaultMultiTrack,
  defaultMultiSongSubmissionFormValues,
  multiSongSubmissionFormSchema,
} from "@/lib/submission/multi-form";
import {
  defaultSongSubmissionFormValues,
  songSubmissionFormSchema,
} from "@/lib/submission/song-form";

const createFile = (name: string, contents: string, type: string) =>
  new File([contents], name, { type });

describe("submission form schemas", () => {
  it("exposes stable default values", () => {
    expect(defaultSongSubmissionFormValues).toMatchObject({
      submissionType: "manual",
      songTitle: "",
      artist: "",
      songLink: "",
      comment: "",
    });

    expect(defaultMultiSongSubmissionFormValues).toMatchObject({
      submissionType: "manual",
      tracks: [{ songTitle: "", artist: "", comment: "" }],
    });

    expect(defaultAlbumSubmissionFormValues).toMatchObject({
      submissionType: "manual",
      albumName: "",
      albumArtist: "",
      tracks: [{ trackNumber: 1, songTitle: "", artist: "" }],
    });
  });

  it("creates default track entries for multi and album forms", () => {
    expect(createDefaultMultiTrack()).toEqual({
      songTitle: "",
      artist: "",
      comment: "",
    });

    expect(createDefaultAlbumTrack(3)).toEqual({
      trackNumber: 3,
      songTitle: "",
      artist: "",
    });
  });

  it("validates manual song submission requirements", () => {
    const validManual = songSubmissionFormSchema.safeParse({
      submissionType: "manual",
      songTitle: "Song",
      artist: "Artist",
      albumArtFile: createFile("cover.png", "cover", "image/png"),
      songFile: createFile("song.mp3", "audio", "audio/mpeg"),
      comment: "Nice track",
    });

    expect(validManual.success).toBe(true);

    const missingFiles = songSubmissionFormSchema.safeParse({
      submissionType: "manual",
      songTitle: "Song",
      artist: "Artist",
    });

    expect(missingFiles.success).toBe(false);
    if (!missingFiles.success) {
      const paths = missingFiles.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("submissionType");
    }
  });

  it("validates link song submission requirements", () => {
    const validLink = songSubmissionFormSchema.safeParse({
      submissionType: "link",
      songLink: "https://youtu.be/abc123def45",
      comment: "Classic",
    });
    expect(validLink.success).toBe(true);

    const invalidLink = songSubmissionFormSchema.safeParse({
      submissionType: "link",
      songLink: "https://example.com/not-youtube",
    });
    expect(invalidLink.success).toBe(false);
  });

  it("validates manual and link multi-track requirements", () => {
    const validManual = multiSongSubmissionFormSchema.safeParse({
      submissionType: "manual",
      tracks: [
        {
          songTitle: "Track 1",
          artist: "Artist 1",
          albumArtFile: createFile("cover1.png", "cover1", "image/png"),
          songFile: createFile("song1.mp3", "audio1", "audio/mpeg"),
        },
        {
          songTitle: "Track 2",
          artist: "Artist 2",
          albumArtFile: createFile("cover2.png", "cover2", "image/png"),
          songFile: createFile("song2.mp3", "audio2", "audio/mpeg"),
        },
      ],
    });
    expect(validManual.success).toBe(true);

    const invalidLink = multiSongSubmissionFormSchema.safeParse({
      submissionType: "link",
      tracks: [
        {
          songTitle: "Track 1",
          artist: "Artist 1",
          songLink: "https://youtu.be/abc123def45",
        },
        {
          songTitle: "Track 2",
          artist: "Artist 2",
          songLink: "https://example.com/not-youtube",
        },
      ],
    });
    expect(invalidLink.success).toBe(false);
  });

  it("validates album submission requirements for manual and link modes", () => {
    const validManual = albumSubmissionFormSchema.safeParse({
      submissionType: "manual",
      albumName: "Album Name",
      albumArtist: "Album Artist",
      albumArtFile: createFile("album.png", "cover", "image/png"),
      tracks: [
        {
          trackNumber: 1,
          songTitle: "Track 1",
          artist: "Artist 1",
          songFile: createFile("song1.mp3", "audio1", "audio/mpeg"),
        },
      ],
    });
    expect(validManual.success).toBe(true);

    const validLink = albumSubmissionFormSchema.safeParse({
      submissionType: "link",
      albumName: "Album Name",
      albumArtist: "Album Artist",
      tracks: [
        {
          trackNumber: 1,
          songTitle: "Track 1",
          songLink: "https://youtu.be/abc123def45",
        },
      ],
    });
    expect(validLink.success).toBe(true);

    const invalidMissingAlbumArt = albumSubmissionFormSchema.safeParse({
      submissionType: "manual",
      albumName: "Album Name",
      albumArtist: "Album Artist",
      tracks: [
        {
          trackNumber: 1,
          songTitle: "Track 1",
          songFile: createFile("song1.mp3", "audio1", "audio/mpeg"),
        },
      ],
    });
    expect(invalidMissingAlbumArt.success).toBe(false);
  });
});
