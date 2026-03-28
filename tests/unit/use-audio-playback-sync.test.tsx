import { createRef } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioPlaybackSync } from "@/hooks/useAudioPlaybackSync";
import type { Song } from "@/types";

vi.mock("@/lib/music/youtube-playlist-session", () => ({
  openUrlInNewTabWithFallback: vi.fn(),
}));

describe("useAudioPlaybackSync", () => {
  const setProgress = vi.fn();
  const setIsPlaying = vi.fn();
  const getPresignedSongUrl = vi.fn();
  const onRefreshedUrl = vi.fn();

  const currentTrack = {
    _id: "submission-1",
    submissionType: "file",
    songTitle: "Track",
    artist: "Artist",
    songFileUrl:
      "/api/media/submissions/submission-1/audio?mediaToken=test&mediaExpires=9999999999999",
  } as Song;

  beforeEach(() => {
    setProgress.mockReset();
    setIsPlaying.mockReset();
    getPresignedSongUrl.mockReset();
    onRefreshedUrl.mockReset();
  });

  it("does not reload the same relative URL when toggling playback", async () => {
    const audioElement = document.createElement("audio");
    const playMock = vi
      .spyOn(audioElement, "play")
      .mockResolvedValue(undefined);
    const pauseMock = vi.spyOn(audioElement, "pause").mockImplementation(() => {});
    const loadMock = vi.spyOn(audioElement, "load").mockImplementation(() => {});

    const audioRef = createRef<HTMLAudioElement | null>();
    audioRef.current = audioElement;

    const { rerender } = renderHook(
      ({
        isPlaying,
      }: {
        isPlaying: boolean;
      }) =>
        useAudioPlaybackSync({
          audioRef,
          currentTrack,
          effectiveSongUrl: currentTrack.songFileUrl,
          isExternalLink: false,
          isPlaying,
          volume: 1,
          setProgress,
          setIsPlaying,
          getPresignedSongUrl,
          onRefreshedUrl,
        }),
      {
        initialProps: { isPlaying: true },
      },
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadMock).toHaveBeenCalledTimes(1);
    expect(playMock).toHaveBeenCalledTimes(1);

    audioElement.currentTime = 42;

    rerender({ isPlaying: false });

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadMock).toHaveBeenCalledTimes(1);
    expect(pauseMock).toHaveBeenCalled();
    expect(audioElement.currentTime).toBe(42);
  });
});
