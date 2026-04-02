import { describe, expect, it } from "vitest";
import {
  buildAndroidIntentUrl,
  buildYouTubeWatchVideosUrl,
  extractYouTubeVideoId,
  getYouTubeOpenTarget,
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

  it("builds Android intent urls with a browser fallback", () => {
    expect(
      buildAndroidIntentUrl(
        "https://www.youtube.com/watch_videos?video_ids=abc123,def456",
      ),
    ).toBe(
      "intent://www.youtube.com/watch_videos?video_ids=abc123,def456#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=https%3A%2F%2Fwww.youtube.com%2Fwatch_videos%3Fvideo_ids%3Dabc123%2Cdef456;end",
    );
  });

  it("prefers mobile app targets for supported mobile browsers", () => {
    const url = "https://www.youtube.com/watch_videos?video_ids=abc123,def456";

    expect(
      getYouTubeOpenTarget(url, {
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 Chrome/135.0.0.0 Mobile Safari/537.36",
      }),
    ).toEqual({
      url: buildAndroidIntentUrl(url),
      useCurrentTab: true,
    });

    expect(
      getYouTubeOpenTarget(url, {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 Version/18.3 Mobile/15E148 Safari/604.1",
      }),
    ).toEqual({
      url,
      useCurrentTab: true,
    });

    expect(
      getYouTubeOpenTarget(url, {
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/135.0.0.0 Safari/537.36",
      }),
    ).toEqual({
      url,
      useCurrentTab: false,
    });
  });
});
