import { describe, expect, it, vi } from "vitest";
import {
  getQueueYouTubeVideoIds,
  markRoundYouTubePlaylistOpened,
} from "@/lib/music/youtube-queue";

describe("youtube queue helpers", () => {
  it("collects unique youtube ids up to max size", () => {
    const queue = [
      { submissionType: "youtube", songLink: "a" },
      { submissionType: "file", songLink: "ignored" },
      { submissionType: "youtube", songLink: "b" },
      { submissionType: "youtube", songLink: "a" },
    ];
    const extract = (value: string | null | undefined) => value ?? null;

    expect(getQueueYouTubeVideoIds(queue, extract, 2)).toEqual(["a", "b"]);
  });

  it("marks playlist as opened in session storage", () => {
    const storage = { setItem: vi.fn() };
    markRoundYouTubePlaylistOpened("round-1", storage);
    expect(storage.setItem).toHaveBeenCalledWith(
      "ytPlaylist:round-1:opened",
      "1",
    );
  });
});
