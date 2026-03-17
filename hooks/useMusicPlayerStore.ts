// hooks/useMusicPlayerStore.ts
import { create } from "zustand";
import { Song } from "@/types";

export type RepeatMode = "none" | "one" | "all";

interface MusicPlayerState {
  queue: Song[];
  originalQueue: Song[];
  currentTrackIndex: number | null;
  isPlaying: boolean;
  presenceSource: "player" | "youtubePlaylist" | null;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  seekTo: number | null;
  volume: number;
  currentTime: number;
  duration: number;
  isContextViewOpen: boolean;
  listenProgress: Record<string, boolean>;
  actions: {
    playRound: (songs: Song[], startIndex?: number) => void;
    playSong: (song: Song) => void;
    playNext: () => void;
    playPrevious: () => void;
    togglePlayPause: () => void;
    setIsPlaying: (playing: boolean) => void;
    setPresenceSource: (
      source: "player" | "youtubePlaylist" | null,
    ) => void;
    clearQueue: () => void;
    toggleRepeat: () => void;
    toggleShuffle: () => void;
    seek: (time: number) => void;
    resetSeek: () => void;
    setVolume: (volume: number) => void;
    openContextView: () => void;
    toggleContextView: () => void;
    closeContextView: () => void;
    setListenProgress: (submissionId: string, isListened: boolean) => void;
    setPlaybackTime: (time: number) => void;
    setPlaybackDuration: (duration: number) => void;
  };
}

export const useMusicPlayerStore = create<MusicPlayerState>((set, get) => ({
  queue: [],
  originalQueue: [],
  currentTrackIndex: null,
  isPlaying: false,
  presenceSource: null,
  repeatMode: "none",
  isShuffled: false,
  volume: 1,
  seekTo: null,
  currentTime: 0,
  duration: 0,
  isContextViewOpen: false,
  listenProgress: {},
  actions: {
    playRound: (songs, startIndex = 0) => {
      set({
        queue: songs,
        originalQueue: songs,
        currentTrackIndex: startIndex,
        isPlaying: true,
        presenceSource: "player",
        isShuffled: false,
      });
    },
    playSong: (song) => {
      set({
        queue: [song],
        originalQueue: [song],
        currentTrackIndex: 0,
        isPlaying: true,
        presenceSource: "player",
        isShuffled: false,
      });
    },
    playNext: () => {
      const { queue, currentTrackIndex, repeatMode } = get();
      if (currentTrackIndex === null) return;

      const isAtEnd = currentTrackIndex === queue.length - 1;

      if (isAtEnd) {
        if (repeatMode === "all") {
          set({
            currentTrackIndex: 0,
            isPlaying: true,
            presenceSource: "player",
          });
        } else {
          set({
            isPlaying: false,
            currentTrackIndex: null,
            presenceSource: null,
          });
        }
      } else {
        set({
          currentTrackIndex: currentTrackIndex + 1,
          isPlaying: true,
          presenceSource: "player",
        });
      }
    },
    playPrevious: () => {
      const { currentTrackIndex } = get();
      if (currentTrackIndex !== null && currentTrackIndex > 0) {
        set({
          currentTrackIndex: currentTrackIndex - 1,
          isPlaying: true,
          presenceSource: "player",
        });
      }
    },
    togglePlayPause: () => {
      const { isPlaying, queue, currentTrackIndex } = get();
      const currentTrack =
        currentTrackIndex !== null ? queue[currentTrackIndex] : null;
      if (queue.length > 0) {
        set({
          isPlaying: !isPlaying,
          presenceSource:
            currentTrack?.submissionType === "file" ? "player" : null,
        });
      }
    },
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    setPresenceSource: (presenceSource) => set({ presenceSource }),
    clearQueue: () =>
      set({
        queue: [],
        originalQueue: [],
        currentTrackIndex: null,
        isPlaying: false,
        presenceSource: null,
      }),
    toggleRepeat: () => {
      const { repeatMode } = get();
      const nextMode: RepeatMode =
        repeatMode === "none" ? "all" : repeatMode === "all" ? "one" : "none";
      set({ repeatMode: nextMode });
    },
    toggleShuffle: () => {
      const { isShuffled, queue, originalQueue, currentTrackIndex } = get();
      const currentTrack =
        currentTrackIndex !== null ? queue[currentTrackIndex] : null;

      if (isShuffled) {
        const newIndex = currentTrack
          ? originalQueue.findIndex((track) => track._id === currentTrack._id)
          : 0;
        set({
          queue: originalQueue,
          isShuffled: false,
          currentTrackIndex: newIndex !== -1 ? newIndex : 0,
        });
      } else {
        if (queue.length <= 1) return;
        const newQueue = [...queue];
        const currentItem = currentTrack
          ? newQueue.splice(currentTrackIndex!, 1)[0]
          : null;

        for (let i = newQueue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const current = newQueue[i];
          const target = newQueue[j];
          if (current === undefined || target === undefined) continue;
          newQueue[i] = target;
          newQueue[j] = current;
        }

        if (currentItem) newQueue.unshift(currentItem);

        set({
          queue: newQueue,
          isShuffled: true,
          currentTrackIndex: 0,
        });
      }
    },
    seek: (time) => set({ seekTo: time }),
    resetSeek: () => set({ seekTo: null }),
    setVolume: (volume) => set({ volume }),
    openContextView: () => {
      const { currentTrackIndex } = get();
      if (currentTrackIndex !== null) {
        set({ isContextViewOpen: true });
      }
    },
    toggleContextView: () => {
      const { isContextViewOpen, currentTrackIndex } = get();
      if (currentTrackIndex !== null) {
        set({ isContextViewOpen: !isContextViewOpen });
      } else {
        set({ isContextViewOpen: false });
      }
    },
    closeContextView: () => set({ isContextViewOpen: false }),
    setListenProgress: (submissionId, isListened) => {
      set((state) => ({
        listenProgress: {
          ...state.listenProgress,
          [submissionId]: isListened,
        },
      }));
    },
    setPlaybackTime: (time) => set({ currentTime: time }),
    setPlaybackDuration: (duration) => set({ duration }),
  },
}));
