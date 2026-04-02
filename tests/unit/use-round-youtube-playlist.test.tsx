import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "convex/react";
import { useRoundYouTubePlaylist } from "@/hooks/useRoundYouTubePlaylist";
import { openYouTubeUrlWithAppFallback } from "@/lib/music/youtube-playlist-session";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("@/lib/music/youtube-playlist-session", () => ({
  openYouTubeUrlWithAppFallback: vi.fn(),
}));

describe("useRoundYouTubePlaylist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reopens a completed playlist without starting a new timer", async () => {
    const roundId = "round-1" as never;
    const serverSession = {
      active: false,
      done: true,
      readyToComplete: false,
      startedAt: null,
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
        youtubeVideoIds: ["abc123", "def456"],
        youtubeUnlocks: [
          {
            submissionIds: ["sub-1"],
            durationSeconds: 240,
            requiredListenSeconds: 240,
            unlockAfterSeconds: 240,
          },
          {
            submissionIds: ["sub-2"],
            durationSeconds: 180,
            requiredListenSeconds: 180,
            unlockAfterSeconds: 420,
          },
        ] as never,
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
      expect(openYouTubeUrlWithAppFallback).toHaveBeenCalledWith(
        "https://www.youtube.com/watch_videos?video_ids=abc123,def456",
      );
    });

    vi.mocked(openYouTubeUrlWithAppFallback).mockClear();

    await act(async () => {
      result.current.openPlaylistAndStart(["def456", "abc123"]);
    });

    await waitFor(() => {
      expect(openYouTubeUrlWithAppFallback).toHaveBeenCalledWith(
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

  it("marks songs locally as each playlist threshold is reached", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));

    const roundId = "round-1" as never;
    const onMarkCompletedLocal = vi.fn();
    const serverSession = {
      active: true,
      done: false,
      readyToComplete: false,
      startedAt: Date.now(),
      endAt: Date.now() + 300_000,
      remainingSec: 300,
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

    renderHook(() =>
      useRoundYouTubePlaylist({
        roundId,
        roundStatus: "voting",
        youtubeVideoIds: ["abc123", "def456", "ghi789"],
        youtubeUnlocks: [
          {
            submissionIds: ["sub-1"],
            durationSeconds: 240,
            requiredListenSeconds: 120,
            unlockAfterSeconds: 120,
          },
          {
            submissionIds: ["sub-2"],
            durationSeconds: 300,
            requiredListenSeconds: 150,
            unlockAfterSeconds: 270,
          },
          {
            submissionIds: ["sub-3"],
            durationSeconds: 180,
            requiredListenSeconds: 90,
            unlockAfterSeconds: 360,
          },
        ] as never,
        totalYouTubeDurationSec: 360,
        onMarkCompletedLocal,
      }),
    );

    expect(updatePresence).toHaveBeenCalledWith({
      listeningTo: null,
      roundId,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(onMarkCompletedLocal).toHaveBeenCalledWith("sub-1");
    expect(onMarkCompletedLocal).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150_000);
    });

    expect(onMarkCompletedLocal).toHaveBeenCalledWith("sub-2");
    expect(onMarkCompletedLocal).toHaveBeenCalledTimes(2);
  });
});
