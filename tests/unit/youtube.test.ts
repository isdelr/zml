import { describe, expect, it } from "vitest";
import {
  buildYouTubeWatchVideosUrl,
  extractYouTubeVideoId,
  isYouTubeLink,
} from "@/lib/youtube";

describe("youtube helpers", () => {
  it("recognizes supported youtube links", () => {
    expect(isYouTubeLink("https://www.youtube.com/watch?v=abc123def45")).toBe(
      true,
    );
    expect(isYouTubeLink("https://youtu.be/abc123def45")).toBe(true);
    expect(isYouTubeLink("https://example.com/video")).toBe(false);
  });

  it("extracts video ids from multiple url formats", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/watch?v=abc123def45"),
    ).toBe("abc123def45");
    expect(extractYouTubeVideoId("https://youtu.be/abc123def45")).toBe(
      "abc123def45",
    );
    expect(
      extractYouTubeVideoId("https://www.youtube.com/shorts/abc123def45"),
    ).toBe("abc123def45");
  });

  it("builds watch_videos urls and limits to 50 ids", () => {
    const ids = Array.from({ length: 55 }, (_, i) => `id${i}`);
    const url = buildYouTubeWatchVideosUrl(ids);
    expect(url).toContain("watch_videos");
    expect(url?.split("video_ids=")[1]?.split(",").length).toBe(50);
  });
});

