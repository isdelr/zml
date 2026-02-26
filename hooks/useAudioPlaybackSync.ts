"use client";

import { RefObject, useCallback, useEffect, useRef } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { Song } from "@/types";
import {
  getPresignedUrlRefreshDelayMs,
  parsePresignedUrlExpiry,
} from "@/lib/music/presigned-url";

type UseAudioPlaybackSyncArgs = {
  audioRef: RefObject<HTMLAudioElement | null>;
  currentTrack: Song | null;
  effectiveSongUrl: string | null;
  isExternalLink: boolean;
  isPlaying: boolean;
  volume: number;
  setProgress: (value: number) => void;
  setIsPlaying: (value: boolean) => void;
  getPresignedSongUrl: (args: {
    submissionId: Id<"submissions">;
  }) => Promise<string | null>;
  onRefreshedUrl: (args: { submissionId: string; url: string }) => void;
};

export function useAudioPlaybackSync({
  audioRef,
  currentTrack,
  effectiveSongUrl,
  isExternalLink,
  isPlaying,
  volume,
  setProgress,
  setIsPlaying,
  getPresignedSongUrl,
  onRefreshedUrl,
}: UseAudioPlaybackSyncArgs): {
  refreshAudioUrl: (silent?: boolean) => Promise<void>;
  handleAudioError: () => Promise<void>;
} {
  const lastOpenedTrackIdRef = useRef<string | null>(null);
  const audioRefreshTimeoutRef = useRef<number | null>(null);
  const prevTrackIdRef = useRef<string | null>(null);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const pendingShouldPlayRef = useRef<boolean>(false);

  const refreshAudioUrl = useCallback(
    async (silent = true) => {
      const audioElement = audioRef.current;
      if (!audioElement || !currentTrack || currentTrack.submissionType !== "file") {
        return;
      }
      try {
        pendingSeekTimeRef.current = Number.isFinite(audioElement.currentTime)
          ? audioElement.currentTime
          : 0;
        pendingShouldPlayRef.current = !audioElement.paused;

        const newUrl = await getPresignedSongUrl({
          submissionId: currentTrack._id,
        });
        if (newUrl) {
          onRefreshedUrl({ submissionId: currentTrack._id, url: newUrl });
        } else {
          setIsPlaying(false);
        }
      } catch (error) {
        if (!silent) {
          console.error("Failed to refresh audio URL", error);
        }
      }
    },
    [audioRef, currentTrack, getPresignedSongUrl, onRefreshedUrl, setIsPlaying],
  );

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement || !currentTrack) return;
    audioElement.volume = volume;

    if (isExternalLink) {
      audioElement.pause();
      if (isPlaying && currentTrack._id !== lastOpenedTrackIdRef.current) {
        window.open(currentTrack.songLink!, "_blank", "noopener,noreferrer");
        lastOpenedTrackIdRef.current = currentTrack._id;
      }
      return;
    }

    lastOpenedTrackIdRef.current = null;

    const prevTrackId = prevTrackIdRef.current;
    const sameTrack = prevTrackId === currentTrack._id;
    prevTrackIdRef.current = currentTrack._id;

    const scheduleAudioRefresh = (url?: string | null) => {
      if (audioRefreshTimeoutRef.current) {
        window.clearTimeout(audioRefreshTimeoutRef.current);
        audioRefreshTimeoutRef.current = null;
      }
      const expiry = parsePresignedUrlExpiry(url ?? undefined);
      const delay = getPresignedUrlRefreshDelayMs(expiry);
      audioRefreshTimeoutRef.current = window.setTimeout(async () => {
        await refreshAudioUrl(true);
      }, delay);
    };
    scheduleAudioRefresh(effectiveSongUrl || undefined);

    const applyPendingRestore = async () => {
      const targetTime = pendingSeekTimeRef.current ?? 0;
      const shouldPlay = pendingShouldPlayRef.current;
      pendingSeekTimeRef.current = null;
      pendingShouldPlayRef.current = false;
      try {
        if (!Number.isNaN(audioElement.duration)) {
          audioElement.currentTime = Math.min(
            targetTime,
            audioElement.duration || targetTime,
          );
        } else {
          audioElement.currentTime = targetTime;
        }
        if (shouldPlay) {
          await audioElement.play();
        }
      } catch {
        // keep silent
      }
    };

    const handlePlayback = async () => {
      if (effectiveSongUrl && audioElement.src !== effectiveSongUrl) {
        const isRefresh = sameTrack;
        try {
          audioElement.src = effectiveSongUrl;
          if (isRefresh && pendingSeekTimeRef.current !== null) {
            const onLoaded = async () => {
              audioElement.removeEventListener("loadedmetadata", onLoaded);
              await applyPendingRestore();
            };
            audioElement.addEventListener("loadedmetadata", onLoaded);
          } else {
            setProgress(0);
            if (isPlaying) {
              await audioElement.play();
            } else {
              audioElement.pause();
            }
          }
        } catch (error: unknown) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.error("Error during playback:", error);
            setIsPlaying(false);
          }
        }
      } else {
        try {
          if (isPlaying) {
            await audioElement.play();
          } else {
            audioElement.pause();
          }
        } catch (error: unknown) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.error("Error during playback:", error);
            setIsPlaying(false);
          }
        }
      }
    };

    void handlePlayback();

    return () => {
      if (audioRefreshTimeoutRef.current) {
        window.clearTimeout(audioRefreshTimeoutRef.current);
        audioRefreshTimeoutRef.current = null;
      }
    };
  }, [
    audioRef,
    currentTrack,
    effectiveSongUrl,
    isExternalLink,
    isPlaying,
    refreshAudioUrl,
    setIsPlaying,
    setProgress,
    volume,
  ]);

  const handleAudioError = useCallback(async () => {
    const audioElement = audioRef.current;
    if (!audioElement || !currentTrack || currentTrack.submissionType !== "file") {
      return;
    }
    try {
      await refreshAudioUrl(true);
    } catch {
      // silent
    }
  }, [audioRef, currentTrack, refreshAudioUrl]);

  return { refreshAudioUrl, handleAudioError };
}
