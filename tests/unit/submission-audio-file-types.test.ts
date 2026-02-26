import { describe, expect, it } from "vitest";

import {
  AUDIO_UPLOAD_ACCEPT,
  isSupportedAudioUploadType,
  SUPPORTED_AUDIO_UPLOAD_EXTENSIONS,
} from "@/lib/submission/audio-file-types";

describe("submission audio file types", () => {
  it("accepts common audio MIME types", () => {
    expect(
      isSupportedAudioUploadType({ name: "track.mp3", type: "audio/mpeg" }),
    ).toBe(true);
    expect(
      isSupportedAudioUploadType({ name: "track.m4a", type: "audio/mp4" }),
    ).toBe(true);
    expect(
      isSupportedAudioUploadType({ name: "track.wav", type: "audio/wav" }),
    ).toBe(true);
  });

  it("accepts supported extensions when MIME type is missing", () => {
    expect(
      isSupportedAudioUploadType({ name: "iphone-export.mp3", type: "" }),
    ).toBe(true);
    expect(
      isSupportedAudioUploadType({ name: "voice-note.m4a", type: "" }),
    ).toBe(true);
  });

  it("accepts mp4 container fallback for m4a uploads", () => {
    expect(
      isSupportedAudioUploadType({ name: "voice-note.m4a", type: "video/mp4" }),
    ).toBe(true);
    expect(
      isSupportedAudioUploadType({
        name: "video-track.mov",
        type: "video/quicktime",
      }),
    ).toBe(false);
  });

  it("rejects unsupported file types", () => {
    expect(
      isSupportedAudioUploadType({ name: "cover.png", type: "image/png" }),
    ).toBe(false);
    expect(
      isSupportedAudioUploadType({ name: "script.txt", type: "text/plain" }),
    ).toBe(false);
  });

  it("exposes stable supported extension and accept lists", () => {
    expect(SUPPORTED_AUDIO_UPLOAD_EXTENSIONS).toEqual(
      expect.arrayContaining([
        ".mp3",
        ".m4a",
        ".aac",
        ".wav",
        ".flac",
        ".ogg",
        ".opus",
      ]),
    );
    expect(AUDIO_UPLOAD_ACCEPT).toContain("audio/*");
    expect(AUDIO_UPLOAD_ACCEPT).toContain(".mp3");
    expect(AUDIO_UPLOAD_ACCEPT).toContain(".m4a");
  });
});
