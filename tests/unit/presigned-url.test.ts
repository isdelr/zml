import { describe, expect, it } from "vitest";
import { parsePresignedUrlExpiry } from "@/lib/music/presigned-url";

describe("presigned url helpers", () => {
  it("parses X-Amz-Date and X-Amz-Expires into expiry timestamp", () => {
    const url =
      "https://example.com/file.mp3?X-Amz-Date=20260208T120000Z&X-Amz-Expires=900";
    const expiry = parsePresignedUrlExpiry(url);
    expect(expiry).toBe(Date.UTC(2026, 1, 8, 12, 15, 0));
  });

  it("parses mediaExpires from stable media URLs", () => {
    const expiry = parsePresignedUrlExpiry(
      "https://media.example.com/api/media/submissions/abc/audio?mediaExpires=1770000000000&mediaToken=test",
    );
    expect(expiry).toBe(1770000000000);
  });
});
