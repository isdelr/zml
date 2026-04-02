import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { usePlaybackClockStore } from "@/hooks/usePlaybackClockStore";

function resetMusicPlayerStore() {
  useMusicPlayerStore.setState({
    queue: [],
    originalQueue: [],
    currentTrackIndex: null,
    isPlaying: false,
    presenceSource: null,
    repeatMode: "none",
    isShuffled: false,
    seekTo: null,
    volume: 1,
    isContextViewOpen: false,
    listenProgress: {},
  });
}

describe("player store render isolation", () => {
  beforeEach(() => {
    resetMusicPlayerStore();
    usePlaybackClockStore.getState().actions.resetPlaybackClock();
  });

  it("does not re-render music player store subscribers on playback clock ticks", () => {
    const playerRender = vi.fn();
    const clockRender = vi.fn();

    function MusicPlayerSubscriber() {
      useMusicPlayerStore((state) => state.currentTrackIndex);
      playerRender();
      return null;
    }

    function PlaybackClockSubscriber() {
      usePlaybackClockStore((state) => state.currentTime);
      clockRender();
      return null;
    }

    render(
      <>
        <MusicPlayerSubscriber />
        <PlaybackClockSubscriber />
      </>,
    );

    expect(playerRender).toHaveBeenCalledTimes(1);
    expect(clockRender).toHaveBeenCalledTimes(1);

    act(() => {
      usePlaybackClockStore.getState().actions.syncPlaybackClock(12, 180);
    });

    expect(playerRender).toHaveBeenCalledTimes(1);
    expect(clockRender).toHaveBeenCalledTimes(2);

    act(() => {
      usePlaybackClockStore.getState().actions.syncPlaybackClock(12, 180);
    });

    expect(playerRender).toHaveBeenCalledTimes(1);
    expect(clockRender).toHaveBeenCalledTimes(2);
  });
});
