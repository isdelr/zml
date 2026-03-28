import { afterEach, describe, expect, it } from "vitest";
import {
  buildSubmissionAudioDownloadPath,
  buildSubmissionMediaPath,
  buildSubmissionMediaUrl,
  createMediaAccessToken,
  resolveMediaAccessScope,
  verifyMediaAccessToken,
} from "@/lib/media/delivery";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("media delivery helpers", () => {
  it("builds the stable media path for a submission asset", () => {
    expect(buildSubmissionMediaPath("submission-123", "audio")).toBe(
      "/api/media/submissions/submission-123/audio",
    );
  });

  it("builds the stable download path for submission audio", () => {
    expect(buildSubmissionAudioDownloadPath("submission-123")).toBe(
      "/api/media/submissions/submission-123/audio/download",
    );
  });

  it("creates and verifies a media access token", async () => {
    process.env.MEDIA_ACCESS_SECRET = "test-media-secret";

    const { token, expiresAt } = await createMediaAccessToken({
      submissionId: "submission-123",
      assetKind: "audio",
      storageKey: "submissions/audio/test.m4a",
      scope: { type: "user", userId: "user-456" },
      nowMs: 1_000,
    });

    const payload = await verifyMediaAccessToken(token);
    expect(payload).toEqual({
      v: 1,
      submissionId: "submission-123",
      assetKind: "audio",
      storageKey: "submissions/audio/test.m4a",
      scope: "user",
      userId: "user-456",
      expiresAt,
    });
  });

  it("prefers public scope for publicly viewable media", () => {
    expect(resolveMediaAccessScope(true, "user-456")).toEqual({
      type: "public",
    });
    expect(resolveMediaAccessScope(false, "user-456")).toEqual({
      type: "user",
      userId: "user-456",
    });
    expect(resolveMediaAccessScope(false, null)).toBeNull();
  });

  it("builds a relative media URL when no delivery base URL is configured", async () => {
    const url = await buildSubmissionMediaUrl({
      submissionId: "submission-123",
      assetKind: "art",
      storageKey: "submissions/art/test.webp",
      scope: { type: "public" },
    });

    const parsed = new URL(url, "http://localhost");
    expect(parsed.pathname).toBe("/api/media/submissions/submission-123/art");
    expect(parsed.search).toBe("");
  });

  it("keeps audio URLs tokenized", async () => {
    process.env.MEDIA_ACCESS_SECRET = "test-media-secret";

    const url = await buildSubmissionMediaUrl({
      submissionId: "submission-123",
      assetKind: "audio",
      storageKey: "submissions/audio/test.mp3",
      scope: { type: "public" },
    });

    const parsed = new URL(url, "http://localhost");
    expect(parsed.pathname).toBe("/api/media/submissions/submission-123/audio");
    expect(parsed.searchParams.get("mediaToken")).toBeTruthy();
    expect(parsed.searchParams.get("mediaExpires")).toBeTruthy();
  });
});
