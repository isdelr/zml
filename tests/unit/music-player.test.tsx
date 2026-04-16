import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  useActionMock,
  useMutationMock,
  useQueryMock,
  useMusicPlayerStoreMock,
  handleAudioErrorMock,
  handleBookmarkToggleMock,
  playNextMock,
  playPreviousMock,
  resetSeekMock,
  setIsPlayingMock,
  setListenProgressMock,
  setPresenceSourceMock,
  setVolumeMock,
  toggleContextViewMock,
  openContextViewMock,
  updateListenProgressMock,
} = vi.hoisted(() => ({
  useActionMock: vi.fn(),
  useMutationMock: vi.fn(),
  useQueryMock: vi.fn(),
  useMusicPlayerStoreMock: vi.fn(),
  handleAudioErrorMock: vi.fn(),
  handleBookmarkToggleMock: vi.fn(),
  playNextMock: vi.fn(),
  playPreviousMock: vi.fn(),
  resetSeekMock: vi.fn(),
  setIsPlayingMock: vi.fn(),
  setListenProgressMock: vi.fn(),
  setPresenceSourceMock: vi.fn(),
  setVolumeMock: vi.fn(),
  toggleContextViewMock: vi.fn(),
  openContextViewMock: vi.fn(),
  updateListenProgressMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useAction: useActionMock,
  useMutation: useMutationMock,
  useQuery: useQueryMock,
}));

vi.mock("@/hooks/useMusicPlayerStore", () => ({
  useMusicPlayerStore: useMusicPlayerStoreMock,
}));

vi.mock("@/hooks/usePlaybackClockStore", () => ({
  usePlaybackClockStore: (
    selector: (state: {
      actions: {
        resetPlaybackClock: ReturnType<typeof vi.fn>;
        syncPlaybackClock: ReturnType<typeof vi.fn>;
      };
    }) => unknown,
  ) =>
    selector({
      actions: {
        resetPlaybackClock: vi.fn(),
        syncPlaybackClock: vi.fn(),
      },
    }),
}));

vi.mock("@/hooks/useWindowSize", () => ({
  useWindowSize: () => ({ width: 0 }),
}));

vi.mock("@/hooks/useListeningPresence", () => ({
  useListeningPresence: vi.fn(),
}));

vi.mock("@/hooks/useSubmissionWaveform", () => ({
  useSubmissionWaveform: () => ({
    waveformData: null,
    isWaveformLoading: false,
  }),
}));

vi.mock("@/hooks/useAudioPlaybackSync", () => ({
  useAudioPlaybackSync: () => ({
    handleAudioError: handleAudioErrorMock,
  }),
}));

vi.mock("@/hooks/useListenProgressSync", () => ({
  useListenProgressSync: vi.fn(),
}));

vi.mock("@/hooks/usePlayerBookmark", () => ({
  usePlayerBookmark: () => ({
    isBookmarked: false,
    handleBookmarkToggle: handleBookmarkToggleMock,
  }),
}));

vi.mock("@/components/ui/dynamic-import", () => ({
  dynamicImport: () => () => null,
}));

describe("MusicPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const queue = [
      {
        _id: "submission-1",
        roundId: "round-1",
        leagueId: "league-1",
        songTitle: "Long Song",
        artist: "Artist",
        albumArtUrl: null,
        songFileUrl: "https://example.com/song.m4a",
        songLink: null,
        duration: 479,
        submissionType: "file",
      },
    ];

    useMusicPlayerStoreMock.mockImplementation(
      (
        selector: (state: {
          queue: typeof queue;
          currentTrackIndex: number;
          isPlaying: boolean;
          presenceSource: "player";
          repeatMode: "none";
          isShuffled: false;
          seekTo: null;
          volume: number;
          listenProgress: Record<string, boolean>;
          isContextViewOpen: false;
          actions: Record<string, ReturnType<typeof vi.fn>>;
        }) => unknown,
      ) =>
        selector({
          queue,
          currentTrackIndex: 0,
          isPlaying: true,
          presenceSource: "player",
          repeatMode: "none",
          isShuffled: false,
          seekTo: null,
          volume: 1,
          listenProgress: {},
          isContextViewOpen: false,
          actions: {
            openContextView: openContextViewMock,
            playNext: playNextMock,
            playPrevious: playPreviousMock,
            resetSeek: resetSeekMock,
            setIsPlaying: setIsPlayingMock,
            setListenProgress: setListenProgressMock,
            setPresenceSource: setPresenceSourceMock,
            setVolume: setVolumeMock,
            toggleContextView: toggleContextViewMock,
            togglePlayPause: vi.fn(),
          },
        }),
    );

    useQueryMock.mockImplementation((_, args: unknown) => {
      if (args === "skip" || !args || typeof args !== "object") {
        return undefined;
      }

      if ("leagueId" in args) {
        return {
          enforceListenPercentage: true,
          listenPercentage: 100,
          listenTimeLimitMinutes: 15,
        };
      }

      if ("roundId" in args) {
        return [
          {
            submissionId: "submission-1",
            progressSeconds: 470,
            isCompleted: false,
          },
        ];
      }

      if ("submissionId" in args) {
        return [];
      }

      return undefined;
    });

    let mutationCallIndex = 0;
    useMutationMock.mockImplementation(() => {
      const mutationFns = [
        vi.fn().mockResolvedValue(undefined),
        updateListenProgressMock,
        vi.fn().mockResolvedValue(undefined),
      ];
      const next = mutationFns[mutationCallIndex % mutationFns.length];
      mutationCallIndex += 1;
      return next;
    });

    useActionMock.mockReturnValue(vi.fn());
    updateListenProgressMock.mockResolvedValue({
      progressSeconds: 478,
      isCompleted: true,
    });
  });

  it("does one final sync on ended playback and marks the track listened before advancing", async () => {
    const { MusicPlayer } = await import("@/components/MusicPlayer");
    const { container } = render(<MusicPlayer />);
    const audioElement = container.querySelector("audio");

    expect(audioElement).not.toBeNull();
    if (!audioElement) {
      return;
    }

    Object.defineProperty(audioElement, "duration", {
      configurable: true,
      value: 478.6,
    });
    Object.defineProperty(audioElement, "currentTime", {
      configurable: true,
      writable: true,
      value: 478.6,
    });

    fireEvent.ended(audioElement);

    await waitFor(() => {
      expect(updateListenProgressMock).toHaveBeenCalledWith({
        submissionId: "submission-1",
        progressSeconds: 478,
      });
    });

    expect(updateListenProgressMock).toHaveBeenCalledTimes(1);
    expect(setListenProgressMock).toHaveBeenCalledWith("submission-1", true);
    expect(playNextMock).toHaveBeenCalledTimes(1);
    expect(updateListenProgressMock.mock.invocationCallOrder[0]).toBeLessThan(
      playNextMock.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it("marks completion internally eight seconds before the full song ends", async () => {
    updateListenProgressMock.mockResolvedValue({
      progressSeconds: 478,
      isCompleted: true,
    });

    const { MusicPlayer } = await import("@/components/MusicPlayer");
    const { container } = render(<MusicPlayer />);
    const audioElement = container.querySelector("audio");

    expect(audioElement).not.toBeNull();
    if (!audioElement) {
      return;
    }

    Object.defineProperty(audioElement, "duration", {
      configurable: true,
      value: 478.6,
    });
    Object.defineProperty(audioElement, "currentTime", {
      configurable: true,
      writable: true,
      value: 470.9,
    });

    fireEvent.timeUpdate(audioElement);

    await waitFor(() => {
      expect(updateListenProgressMock).toHaveBeenCalledWith({
        submissionId: "submission-1",
        progressSeconds: 478,
      });
    });

    expect(setListenProgressMock).toHaveBeenCalledWith("submission-1", true);
    expect(playNextMock).not.toHaveBeenCalled();
  });

  it("repairs stale near-complete progress on load without replaying the end", async () => {
    const queue = [
      {
        _id: "submission-1",
        roundId: "round-1",
        leagueId: "league-1",
        songTitle: "Long Song",
        artist: "Artist",
        albumArtUrl: null,
        songFileUrl: "https://example.com/song.m4a",
        songLink: null,
        duration: 478,
        submissionType: "file",
      },
    ];

    useMusicPlayerStoreMock.mockImplementation(
      (
        selector: (state: {
          queue: typeof queue;
          currentTrackIndex: number;
          isPlaying: boolean;
          presenceSource: "player";
          repeatMode: "none";
          isShuffled: false;
          seekTo: null;
          volume: number;
          listenProgress: Record<string, boolean>;
          isContextViewOpen: false;
          actions: Record<string, ReturnType<typeof vi.fn>>;
        }) => unknown,
      ) =>
        selector({
          queue,
          currentTrackIndex: 0,
          isPlaying: false,
          presenceSource: "player",
          repeatMode: "none",
          isShuffled: false,
          seekTo: null,
          volume: 1,
          listenProgress: {},
          isContextViewOpen: false,
          actions: {
            openContextView: openContextViewMock,
            playNext: playNextMock,
            playPrevious: playPreviousMock,
            resetSeek: resetSeekMock,
            setIsPlaying: setIsPlayingMock,
            setListenProgress: setListenProgressMock,
            setPresenceSource: setPresenceSourceMock,
            setVolume: setVolumeMock,
            toggleContextView: toggleContextViewMock,
            togglePlayPause: vi.fn(),
          },
        }),
    );

    useQueryMock.mockImplementation((_, args: unknown) => {
      if (args === "skip" || !args || typeof args !== "object") {
        return undefined;
      }

      if ("leagueId" in args) {
        return {
          enforceListenPercentage: true,
          listenPercentage: 100,
          listenTimeLimitMinutes: 15,
        };
      }

      if ("roundId" in args) {
        return [
          {
            submissionId: "submission-1",
            progressSeconds: 470,
            isCompleted: false,
          },
        ];
      }

      if ("submissionId" in args) {
        return [];
      }

      return undefined;
    });

    updateListenProgressMock.mockResolvedValue({
      progressSeconds: 478,
      isCompleted: true,
    });

    const { MusicPlayer } = await import("@/components/MusicPlayer");
    render(<MusicPlayer />);

    await waitFor(() => {
      expect(updateListenProgressMock).toHaveBeenCalledWith({
        submissionId: "submission-1",
        progressSeconds: 478,
      });
    });

    expect(setListenProgressMock).toHaveBeenCalledWith("submission-1", true);
    expect(playNextMock).not.toHaveBeenCalled();
  });

  it("catches up stale server progress before marking ended playback complete", async () => {
    useQueryMock.mockImplementation((_, args: unknown) => {
      if (args === "skip" || !args || typeof args !== "object") {
        return undefined;
      }

      if ("leagueId" in args) {
        return {
          enforceListenPercentage: true,
          listenPercentage: 100,
          listenTimeLimitMinutes: 15,
        };
      }

      if ("roundId" in args) {
        return [
          {
            submissionId: "submission-1",
            progressSeconds: 0,
            isCompleted: false,
          },
        ];
      }

      if ("submissionId" in args) {
        return [];
      }

      return undefined;
    });

    [
      47, 94, 141, 188, 235, 282, 329, 376, 423, 470,
    ].forEach((progressSeconds) => {
      updateListenProgressMock.mockResolvedValueOnce({
        progressSeconds,
        isCompleted: false,
      });
    });
    updateListenProgressMock.mockResolvedValueOnce({
      progressSeconds: 478,
      isCompleted: true,
    });

    const { MusicPlayer } = await import("@/components/MusicPlayer");
    const { container } = render(<MusicPlayer />);
    const audioElement = container.querySelector("audio");

    expect(audioElement).not.toBeNull();
    if (!audioElement) {
      return;
    }

    Object.defineProperty(audioElement, "duration", {
      configurable: true,
      value: 478.6,
    });
    Object.defineProperty(audioElement, "currentTime", {
      configurable: true,
      writable: true,
      value: 478.6,
    });

    fireEvent.ended(audioElement);

    await waitFor(() => {
      expect(updateListenProgressMock).toHaveBeenCalledTimes(11);
    });

    expect(updateListenProgressMock).toHaveBeenLastCalledWith({
      submissionId: "submission-1",
      progressSeconds: 478,
    });
    expect(setListenProgressMock).toHaveBeenCalledWith("submission-1", true);
    expect(playNextMock).toHaveBeenCalledTimes(1);
    expect(updateListenProgressMock.mock.invocationCallOrder[10]).toBeLessThan(
      playNextMock.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it("does not mark completion when catch-up progress stops advancing", async () => {
    useQueryMock.mockImplementation((_, args: unknown) => {
      if (args === "skip" || !args || typeof args !== "object") {
        return undefined;
      }

      if ("leagueId" in args) {
        return {
          enforceListenPercentage: true,
          listenPercentage: 100,
          listenTimeLimitMinutes: 15,
        };
      }

      if ("roundId" in args) {
        return [
          {
            submissionId: "submission-1",
            progressSeconds: 0,
            isCompleted: false,
          },
        ];
      }

      if ("submissionId" in args) {
        return [];
      }

      return undefined;
    });

    updateListenProgressMock.mockResolvedValueOnce({
      progressSeconds: 0,
      isCompleted: false,
    });

    const { MusicPlayer } = await import("@/components/MusicPlayer");
    const { container } = render(<MusicPlayer />);
    const audioElement = container.querySelector("audio");

    expect(audioElement).not.toBeNull();
    if (!audioElement) {
      return;
    }

    Object.defineProperty(audioElement, "duration", {
      configurable: true,
      value: 478.6,
    });
    Object.defineProperty(audioElement, "currentTime", {
      configurable: true,
      writable: true,
      value: 478.6,
    });

    fireEvent.ended(audioElement);

    await waitFor(() => {
      expect(playNextMock).toHaveBeenCalledTimes(1);
    });

    expect(updateListenProgressMock).toHaveBeenCalledTimes(1);
    expect(setListenProgressMock).not.toHaveBeenCalled();
  });

  it("marks songs longer than the protection cap as listened once playback reaches the cap", async () => {
    const queue = [
      {
        _id: "submission-long",
        roundId: "round-1",
        leagueId: "league-1",
        songTitle: "Very Long Song",
        artist: "Artist",
        albumArtUrl: null,
        songFileUrl: "https://example.com/long-song.m4a",
        songLink: null,
        duration: 1200,
        submissionType: "file",
      },
    ];

    useMusicPlayerStoreMock.mockImplementation(
      (
        selector: (state: {
          queue: typeof queue;
          currentTrackIndex: number;
          isPlaying: boolean;
          presenceSource: "player";
          repeatMode: "none";
          isShuffled: false;
          seekTo: null;
          volume: number;
          listenProgress: Record<string, boolean>;
          isContextViewOpen: false;
          actions: Record<string, ReturnType<typeof vi.fn>>;
        }) => unknown,
      ) =>
        selector({
          queue,
          currentTrackIndex: 0,
          isPlaying: true,
          presenceSource: "player",
          repeatMode: "none",
          isShuffled: false,
          seekTo: null,
          volume: 1,
          listenProgress: {},
          isContextViewOpen: false,
          actions: {
            openContextView: openContextViewMock,
            playNext: playNextMock,
            playPrevious: playPreviousMock,
            resetSeek: resetSeekMock,
            setIsPlaying: setIsPlayingMock,
            setListenProgress: setListenProgressMock,
            setPresenceSource: setPresenceSourceMock,
            setVolume: setVolumeMock,
            toggleContextView: toggleContextViewMock,
            togglePlayPause: vi.fn(),
          },
        }),
    );

    useQueryMock.mockImplementation((_, args: unknown) => {
      if (args === "skip" || !args || typeof args !== "object") {
        return undefined;
      }

      if ("leagueId" in args) {
        return {
          enforceListenPercentage: true,
          listenPercentage: 100,
          listenTimeLimitMinutes: 15,
        };
      }

      if ("roundId" in args) {
        return [
          {
            submissionId: "submission-long",
            progressSeconds: 870,
            isCompleted: false,
          },
        ];
      }

      if ("submissionId" in args) {
        return [];
      }

      return undefined;
    });

    updateListenProgressMock.mockResolvedValue({
      progressSeconds: 900,
      isCompleted: true,
    });

    const { MusicPlayer } = await import("@/components/MusicPlayer");
    const { container } = render(<MusicPlayer />);
    const audioElement = container.querySelector("audio");

    expect(audioElement).not.toBeNull();
    if (!audioElement) {
      return;
    }

    Object.defineProperty(audioElement, "duration", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(audioElement, "currentTime", {
      configurable: true,
      writable: true,
      value: 900,
    });

    fireEvent.timeUpdate(audioElement);

    await waitFor(() => {
      expect(updateListenProgressMock).toHaveBeenCalledWith({
        submissionId: "submission-long",
        progressSeconds: 900,
      });
    });

    expect(setListenProgressMock).toHaveBeenCalledWith("submission-long", true);
  });
});
