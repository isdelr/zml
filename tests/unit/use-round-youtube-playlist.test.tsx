import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "convex/react";
import { useRoundYouTubePlaylist } from "@/hooks/useRoundYouTubePlaylist";
import { openUrlInNewTabWithFallback } from "@/lib/music/youtube-playlist-session";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("@/lib/music/youtube-playlist-session", () => ({
  openUrlInNewTabWithFallback: vi.fn(),
}));

describe("useRoundYouTubePlaylist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reopens a completed playlist without starting a new timer", async () => {
    const roundId = "round-1" as never;
    const youtubeSubmissionIds = ["sub-1", "sub-2"] as never;
    const serverSession = {
      active: false,
      done: true,
      readyToComplete: false,
      endAt: null,
      remainingSec: 0,
    };
    const startPlaylistSession = vi.fn();
    const completePlaylistSession = vi.fn();
    const updatePresence = vi.fn().mockResolvedValue(undefined);

    let mutationCallIndex = 0;
    vi.mocked(useQuery).mockReturnValue(serverSession);
    (
      useMutation as unknown as {
        mockImplementation: (fn: () => unknown) => void;
      }
    ).mockImplementation(() => {
      const mutationFns = [
        startPlaylistSession,
        completePlaylistSession,
        updatePresence,
      ];
      const next = mutationFns[mutationCallIndex % mutationFns.length];
      mutationCallIndex += 1;
      return next;
    });

    const { result } = renderHook(() =>
      useRoundYouTubePlaylist({
        roundId,
        roundStatus: "voting",
        youtubeSubmissionIds,
        youtubeVideoIds: ["abc123", "def456"],
        totalYouTubeDurationSec: 420,
      }),
    );

    await waitFor(() => {
      expect(result.current.ytInfo.done).toBe(true);
    });

    await act(async () => {
      result.current.ytInfo.onOpen();
    });

    await waitFor(() => {
      expect(openUrlInNewTabWithFallback).toHaveBeenCalledWith(
        "https://www.youtube.com/watch_videos?video_ids=abc123,def456",
      );
    });

    vi.mocked(openUrlInNewTabWithFallback).mockClear();

    await act(async () => {
      result.current.openPlaylistAndStart(["def456", "abc123"]);
    });

    await waitFor(() => {
      expect(openUrlInNewTabWithFallback).toHaveBeenCalledWith(
        "https://www.youtube.com/watch_videos?video_ids=def456,abc123",
      );
    });

    expect(startPlaylistSession).not.toHaveBeenCalled();
    expect(completePlaylistSession).not.toHaveBeenCalled();
    expect(updatePresence).not.toHaveBeenCalledWith({
      listeningTo: null,
      roundId,
    });
  });
});
