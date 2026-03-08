"use client";

import { RefObject, useCallback, useEffect, useRef } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { Song } from "@/types";
import { openUrlInNewTabWithFallback } from "@/lib/music/youtube-playlist-session";

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
  const prevTrackIdRef = useRef<string | null>(null);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const pendingShouldPlayRef = useRef<boolean>(false);
  const desiredPlayingRef = useRef(isPlaying);
  const playbackRequestIdRef = useRef(0);

  useEffect(() => {
    desiredPlayingRef.current = isPlaying;
  }, [isPlaying]);

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
        pendingShouldPlayRef.current =
          desiredPlayingRef.current && !audioElement.paused;

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
    desiredPlayingRef.current = isPlaying;
    const playbackRequestId = playbackRequestIdRef.current + 1;
    playbackRequestIdRef.current = playbackRequestId;

    if (isExternalLink) {
      audioElement.pause();
      if (
        isPlaying &&
        currentTrack.songLink &&
        currentTrack._id !== lastOpenedTrackIdRef.current
      ) {
        openUrlInNewTabWithFallback(currentTrack.songLink, {
          fallbackToCurrentTab: true,
        });
        lastOpenedTrackIdRef.current = currentTrack._id;
      }
      return;
    }

    lastOpenedTrackIdRef.current = null;

    const prevTrackId = prevTrackIdRef.current;
    const sameTrack = prevTrackId === currentTrack._id;
    prevTrackIdRef.current = currentTrack._id;

    const trySyncPlaybackState = async () => {
      if (playbackRequestIdRef.current !== playbackRequestId) {
        return;
      }

      try {
        if (desiredPlayingRef.current) {
          await audioElement.play();
          return;
        }
        audioElement.pause();
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Error during playback:", error);
        setIsPlaying(false);
      }
    };

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
          await trySyncPlaybackState();
        }
      } catch {
        // keep silent
      }
    };

    const handleCanPlay = () => {
      if (!desiredPlayingRef.current) {
        return;
      }
      void trySyncPlaybackState();
    };
    audioElement.addEventListener("canplay", handleCanPlay);
    audioElement.addEventListener("loadeddata", handleCanPlay);

    let loadedMetadataHandler: (() => void) | null = null;

    const handlePlayback = async () => {
      if (effectiveSongUrl && audioElement.src !== effectiveSongUrl) {
        const isRefresh = sameTrack;
        try {
          audioElement.src = effectiveSongUrl;
          audioElement.load();

          if (isRefresh && pendingSeekTimeRef.current !== null) {
            loadedMetadataHandler = () => {
              void applyPendingRestore();
            };
            audioElement.addEventListener(
              "loadedmetadata",
              loadedMetadataHandler,
              { once: true },
            );
            return;
          }

          setProgress(0);
        } catch (error: unknown) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.error("Error during playback:", error);
            setIsPlaying(false);
          }
          return;
        }
      }

      await trySyncPlaybackState();
    };

    void handlePlayback();

    return () => {
      audioElement.removeEventListener("canplay", handleCanPlay);
      audioElement.removeEventListener("loadeddata", handleCanPlay);
      if (loadedMetadataHandler) {
        audioElement.removeEventListener(
          "loadedmetadata",
          loadedMetadataHandler,
        );
      }
    };
  }, [
    audioRef,
    currentTrack,
    effectiveSongUrl,
    isExternalLink,
    isPlaying,
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
