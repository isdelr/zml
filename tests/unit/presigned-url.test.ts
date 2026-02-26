import { describe, expect, it, vi } from "vitest";
import {
  getPresignedUrlRefreshDelayMs,
  parsePresignedUrlExpiry,
} from "@/lib/music/presigned-url";

describe("presigned url helpers", () => {
  it("parses X-Amz-Date and X-Amz-Expires into expiry timestamp", () => {
    const url =
      "https://example.com/file.mp3?X-Amz-Date=20260208T120000Z&X-Amz-Expires=900";
    const expiry = parsePresignedUrlExpiry(url);
    expect(expiry).toBe(Date.UTC(2026, 1, 8, 12, 15, 0));
  });

  it("falls back to default delay when expiry is missing", () => {
    expect(getPresignedUrlRefreshDelayMs(null)).toBe(15 * 60 * 1000);
  });

  it("applies safety window when computing delay", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const expiry = 1_000_000 + 10 * 60 * 1000;
    expect(getPresignedUrlRefreshDelayMs(expiry, Date.now())).toBe(
      9 * 60 * 1000,
    );
  });
});

