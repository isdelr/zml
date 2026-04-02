import { create } from "zustand";

interface PlaybackClockState {
  currentTime: number;
  duration: number;
  actions: {
    syncPlaybackClock: (currentTime: number, duration: number) => void;
    resetPlaybackClock: () => void;
  };
}

export const usePlaybackClockStore = create<PlaybackClockState>((set) => ({
  currentTime: 0,
  duration: 0,
  actions: {
    syncPlaybackClock: (currentTime, duration) =>
      set((state) =>
        state.currentTime === currentTime && state.duration === duration
          ? state
          : { currentTime, duration },
      ),
    resetPlaybackClock: () =>
      set((state) =>
        state.currentTime === 0 && state.duration === 0
          ? state
          : { currentTime: 0, duration: 0 },
      ),
  },
}));
