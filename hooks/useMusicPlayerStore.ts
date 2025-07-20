import { create } from "zustand";
import { Song } from "@/types";

interface MusicPlayerState {
  queue: Song[];
  currentTrackIndex: number | null;
  isPlaying: boolean;
  actions: {
    playRound: (songs: Song[], startIndex?: number) => void;
    playSong: (song: Song) => void;
    playNext: () => void;
    playPrevious: () => void;
    togglePlayPause: () => void;
    setIsPlaying: (playing: boolean) => void;
    clearQueue: () => void;
  };
}

export const useMusicPlayerStore = create<MusicPlayerState>((set, get) => ({
  queue: [],
  currentTrackIndex: null,
  isPlaying: false,
  actions: {
    playRound: (songs, startIndex = 0) => {
      set({
        queue: songs,
        currentTrackIndex: startIndex,
        isPlaying: true,
      });
    },
    playSong: (song) => {
      set({
        queue: [song],
        currentTrackIndex: 0,
        isPlaying: true,
      });
    },
    playNext: () => {
      const { queue, currentTrackIndex } = get();
      if (currentTrackIndex !== null && currentTrackIndex < queue.length - 1) {
        set({ currentTrackIndex: currentTrackIndex + 1, isPlaying: true });
      } else {
        // Reached end of queue
        set({ isPlaying: false, currentTrackIndex: null });
      }
    },
    playPrevious: () => {
      const { currentTrackIndex } = get();
      if (currentTrackIndex !== null && currentTrackIndex > 0) {
        set({ currentTrackIndex: currentTrackIndex - 1 });
      }
    },
    togglePlayPause: () => {
      const { isPlaying, queue } = get();
      if (queue.length > 0) {
        set({ isPlaying: !isPlaying });
      }
    },
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    clearQueue: () =>
      set({ queue: [], currentTrackIndex: null, isPlaying: false }),
  },
}));