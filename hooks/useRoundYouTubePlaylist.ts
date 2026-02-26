"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/lib/convex/api";
import { buildYouTubeWatchVideosUrl } from "@/lib/youtube";

type UseRoundYouTubePlaylistArgs = {
  roundId: Id<"rounds">;
  roundStatus: string;
  youtubeSubmissionIds: Id<"submissions">[];
  youtubeVideoIds: string[];
  totalYouTubeDurationSec: number;
  onMarkCompletedLocal?: (submissionId: Id<"submissions">) => void;
};

type YouTubeInfo = {
  running: boolean;
  done: boolean;
  remainingSec: number;
  videoCount: number;
  totalDurationSec: number;
  onOpen: () => void;
};

export function useRoundYouTubePlaylist({
  roundId,
  roundStatus,
  youtubeSubmissionIds,
  youtubeVideoIds,
  totalYouTubeDurationSec,
  onMarkCompletedLocal,
}: UseRoundYouTubePlaylistArgs): {
  ytInfo: YouTubeInfo;
  ensureAutoOpenOnce: () => void;
  openPlaylistAndStart: (orderedIds?: string[]) => void;
} {
  const markCompletedBatch = useMutation(api.listenProgress.markCompletedBatch);

  const sessionKey = useMemo(() => `ytPlaylist:${roundId}`, [roundId]);
  const sessionOpenedKey = `${sessionKey}:opened`;
  const sessionEndAtKey = `${sessionKey}:endAt`;
  const sessionDurationKey = `${sessionKey}:duration`;
  const sessionDoneKey = `${sessionKey}:done`;

  const [ytTimerRemainingSec, setYtTimerRemainingSec] = useState<number>(0);
  const [ytTimerRunning, setYtTimerRunning] = useState<boolean>(false);
  const [ytTimerDone, setYtTimerDone] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const completeYouTubeListening = useCallback(async () => {
    clearTimer();
    setYtTimerRunning(false);
    setYtTimerRemainingSec(0);
    setYtTimerDone(true);
    try {
      if (youtubeSubmissionIds.length > 0) {
        await markCompletedBatch({ roundId, submissionIds: youtubeSubmissionIds });
        youtubeSubmissionIds.forEach((id) => onMarkCompletedLocal?.(id));
      }
    } catch (error) {
      console.error("Failed to mark playlist listening complete", error);
    } finally {
      try {
        sessionStorage.removeItem(sessionEndAtKey);
        sessionStorage.removeItem(sessionDurationKey);
        localStorage.setItem(sessionDoneKey, "1");
      } catch {}
    }
  }, [
    clearTimer,
    youtubeSubmissionIds,
    markCompletedBatch,
    roundId,
    onMarkCompletedLocal,
    sessionEndAtKey,
    sessionDurationKey,
    sessionDoneKey,
  ]);

  const startPlaylistTimer = useCallback(
    (totalSec: number) => {
      if (!totalSec || totalSec <= 0) return;

      try {
        if (localStorage.getItem(sessionDoneKey) === "1") {
          setYtTimerDone(true);
          setYtTimerRunning(false);
          setYtTimerRemainingSec(0);
          return;
        }
      } catch {}

      try {
        const existingEndAt = sessionStorage.getItem(sessionEndAtKey);
        if (existingEndAt) {
          const remaining = Math.ceil((Number(existingEndAt) - Date.now()) / 1000);
          if (remaining > 0) {
            setYtTimerRunning(true);
            setYtTimerRemainingSec(remaining);
            clearTimer();
            timerRef.current = window.setInterval(() => {
              const left = Math.max(
                0,
                Math.ceil((Number(sessionStorage.getItem(sessionEndAtKey)) - Date.now()) / 1000),
              );
              setYtTimerRemainingSec(left);
              if (left <= 0) void completeYouTubeListening();
            }, 1000);
            return;
          }
        }
      } catch {}

      const endAt = Date.now() + totalSec * 1000;
      try {
        sessionStorage.setItem(sessionEndAtKey, String(endAt));
        sessionStorage.setItem(sessionDurationKey, String(totalSec));
      } catch {}

      setYtTimerRunning(true);
      setYtTimerRemainingSec(totalSec);
      clearTimer();
      timerRef.current = window.setInterval(() => {
        const msLeft = (Number(sessionStorage.getItem(sessionEndAtKey)) || endAt) - Date.now();
        const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
        setYtTimerRemainingSec(secLeft);
        if (secLeft <= 0) {
          void completeYouTubeListening();
        }
      }, 1000);
    },
    [clearTimer, completeYouTubeListening, sessionDoneKey, sessionDurationKey, sessionEndAtKey],
  );

  useEffect(() => {
    try {
      const isDone = localStorage.getItem(sessionDoneKey) === "1";
      if (isDone) {
        setYtTimerDone(true);
        setYtTimerRunning(false);
        setYtTimerRemainingSec(0);
        sessionStorage.removeItem(sessionEndAtKey);
        sessionStorage.removeItem(sessionDurationKey);
      } else {
        const endAtStr = sessionStorage.getItem(sessionEndAtKey);
        const durationStr = sessionStorage.getItem(sessionDurationKey);
        if (endAtStr && durationStr) {
          const endAt = Number(endAtStr);
          const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
          if (remaining > 0) {
            setYtTimerRunning(true);
            setYtTimerRemainingSec(remaining);
            clearTimer();
            timerRef.current = window.setInterval(() => {
              const left = Math.max(
                0,
                Math.ceil((Number(sessionStorage.getItem(sessionEndAtKey)) - Date.now()) / 1000),
              );
              setYtTimerRemainingSec(left);
              if (left <= 0) void completeYouTubeListening();
            }, 1000);
          } else if (endAtStr) {
            void completeYouTubeListening();
          }
        }
      }
    } catch {}

    return () => clearTimer();
  }, [
    sessionEndAtKey,
    sessionDurationKey,
    sessionDoneKey,
    completeYouTubeListening,
    clearTimer,
  ]);

  const openYouTubePlaylist = useCallback((orderedIds: string[]) => {
    const url = buildYouTubeWatchVideosUrl(orderedIds);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const openPlaylistAndStart = useCallback(
    (orderedIds?: string[]) => {
      const ids = orderedIds && orderedIds.length > 0 ? orderedIds : youtubeVideoIds;
      if (ids.length === 0) return;
      openYouTubePlaylist(ids);
      if (!ytTimerDone) {
        startPlaylistTimer(totalYouTubeDurationSec);
      }
      try {
        sessionStorage.setItem(sessionOpenedKey, "1");
      } catch {}
    },
    [
      youtubeVideoIds,
      openYouTubePlaylist,
      ytTimerDone,
      startPlaylistTimer,
      totalYouTubeDurationSec,
      sessionOpenedKey,
    ],
  );

  const ensureAutoOpenOnce = useCallback(() => {
    if (youtubeVideoIds.length === 0) return;
    if (roundStatus !== "voting") return;
    if (ytTimerDone) return;
    try {
      if (sessionStorage.getItem(sessionOpenedKey) === "1") return;
      sessionStorage.setItem(sessionOpenedKey, "1");
    } catch {}
    openYouTubePlaylist(youtubeVideoIds);
    startPlaylistTimer(totalYouTubeDurationSec);
  }, [
    youtubeVideoIds,
    roundStatus,
    ytTimerDone,
    sessionOpenedKey,
    openYouTubePlaylist,
    startPlaylistTimer,
    totalYouTubeDurationSec,
  ]);

  return {
    ytInfo: {
      running: ytTimerRunning,
      done: ytTimerDone,
      remainingSec: ytTimerRemainingSec,
      videoCount: youtubeVideoIds.length,
      totalDurationSec: totalYouTubeDurationSec,
      onOpen: () => {
        openPlaylistAndStart();
      },
    },
    ensureAutoOpenOnce,
    openPlaylistAndStart,
  };
}
