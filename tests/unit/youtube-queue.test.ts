import { describe, expect, it, vi } from "vitest";
import {
  getRoundQueueYouTubePlaylist,
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

  it("derives round-scoped playlist metadata for the queue", () => {
    const extract = (value: string | null | undefined) => value ?? null;
    const queue = [
      {
        _id: "sub-1",
        roundId: "round-1",
        submissionType: "youtube",
        songLink: "a",
        duration: 101,
      },
      {
        _id: "sub-2",
        roundId: "round-1",
        submissionType: "youtube",
        songLink: "b",
        duration: null,
      },
      {
        _id: "sub-3",
        roundId: "round-2",
        submissionType: "youtube",
        songLink: "c",
        duration: 90,
      },
      {
        _id: "sub-4",
        roundId: "round-1",
        submissionType: "youtube",
        songLink: "a",
        duration: 999,
      },
    ];

    expect(
      getRoundQueueYouTubePlaylist(queue, "round-1", extract, 50),
    ).toEqual({
      videoIds: ["a", "b"],
      submissionIds: ["sub-1", "sub-2", "sub-4"],
      totalDurationSec: 281,
    });
  });

  it("rotates round-scoped playlist ids to start at a target submission", () => {
    const extract = (value: string | null | undefined) => value ?? null;
    const queue = [
      {
        _id: "sub-1",
        roundId: "round-1",
        submissionType: "youtube",
        songLink: "a",
        duration: 101,
      },
      {
        _id: "sub-2",
        roundId: "round-1",
        submissionType: "youtube",
        songLink: "b",
        duration: 102,
      },
      {
        _id: "sub-3",
        roundId: "round-1",
        submissionType: "youtube",
        songLink: "c",
        duration: 103,
      },
    ];

    expect(
      getRoundQueueYouTubePlaylist(queue, "round-1", extract, 50, "sub-2"),
    ).toEqual({
      videoIds: ["b", "c", "a"],
      submissionIds: ["sub-1", "sub-2", "sub-3"],
      totalDurationSec: 306,
    });
  });
});
