"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/lib/convex/api";
import { buildYouTubeWatchVideosUrl } from "@/lib/youtube";
import {
  YOUTUBE_PLAYLIST_SESSION_EVENT,
  getRoundYouTubePlaylistSessionSnapshot,
  markRoundYouTubePlaylistDone,
  openUrlInNewTabWithFallback,
  startRoundYouTubePlaylistSession,
} from "@/lib/music/youtube-playlist-session";

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
  const updatePresence = useMutation(api.presence.update);

  const [ytTimerRemainingSec, setYtTimerRemainingSec] = useState<number>(0);
  const [ytTimerRunning, setYtTimerRunning] = useState<boolean>(false);
  const [ytTimerDone, setYtTimerDone] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);

  const updatePlaylistPresence = useCallback(
    (active: boolean) => {
      const args = active ? { listeningTo: null, roundId } : { listeningTo: null };
      void updatePresence(args).catch((error: unknown) => {
        console.warn("[presence:youtube-playlist] non-fatal failure", error);
      });
    },
    [roundId, updatePresence],
  );

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
    updatePlaylistPresence(false);
    try {
      if (youtubeSubmissionIds.length > 0) {
        await markCompletedBatch({ roundId, submissionIds: youtubeSubmissionIds });
        youtubeSubmissionIds.forEach((id) => onMarkCompletedLocal?.(id));
      }
    } catch (error) {
      console.error("Failed to mark playlist listening complete", error);
    } finally {
      markRoundYouTubePlaylistDone(roundId);
    }
  }, [
    clearTimer,
    youtubeSubmissionIds,
    markCompletedBatch,
    roundId,
    onMarkCompletedLocal,
    updatePlaylistPresence,
  ]);

  const syncTimerFromSession = useCallback(() => {
    const session = getRoundYouTubePlaylistSessionSnapshot(roundId);

    if (session.done) {
      clearTimer();
      setYtTimerDone(true);
      setYtTimerRunning(false);
      setYtTimerRemainingSec(0);
      return;
    }

    if (session.active && session.endAt) {
      setYtTimerDone(false);
      setYtTimerRunning(true);
      setYtTimerRemainingSec(session.remainingSec);
      clearTimer();
      timerRef.current = window.setInterval(() => {
        const nextSession = getRoundYouTubePlaylistSessionSnapshot(roundId);
        setYtTimerRemainingSec(nextSession.remainingSec);
        if (nextSession.remainingSec <= 0) {
          void completeYouTubeListening();
        }
      }, 1000);
      return;
    }

    if (session.opened) {
      clearTimer();
      setYtTimerDone(false);
      setYtTimerRunning(false);
      setYtTimerRemainingSec(0);
    }
  }, [clearTimer, completeYouTubeListening, roundId]);

  const startPlaylistTimer = useCallback(
    (totalSec: number) => {
      const session = startRoundYouTubePlaylistSession(roundId, totalSec);
      if (session.done) {
        setYtTimerDone(true);
        setYtTimerRunning(false);
        setYtTimerRemainingSec(0);
        return;
      }
      syncTimerFromSession();
    },
    [roundId, syncTimerFromSession],
  );

  useEffect(() => {
    syncTimerFromSession();

    return () => clearTimer();
  }, [clearTimer, syncTimerFromSession]);

  useEffect(() => {
    const handleSessionEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ roundId?: string }>).detail;
      if (detail?.roundId !== roundId) {
        return;
      }
      syncTimerFromSession();
    };

    window.addEventListener(
      YOUTUBE_PLAYLIST_SESSION_EVENT,
      handleSessionEvent as EventListener,
    );

    return () => {
      window.removeEventListener(
        YOUTUBE_PLAYLIST_SESSION_EVENT,
        handleSessionEvent as EventListener,
      );
    };
  }, [roundId, syncTimerFromSession]);

  const openYouTubePlaylist = useCallback((orderedIds: string[]) => {
    const url = buildYouTubeWatchVideosUrl(orderedIds);
    if (!url) return;
    openUrlInNewTabWithFallback(url);
  }, []);

  const openPlaylistAndStart = useCallback(
    (orderedIds?: string[]) => {
      const ids = orderedIds && orderedIds.length > 0 ? orderedIds : youtubeVideoIds;
      if (ids.length === 0) return;
      if (!ytTimerDone) {
        startPlaylistTimer(totalYouTubeDurationSec);
      }
      updatePlaylistPresence(true);
      openYouTubePlaylist(ids);
    },
    [
      youtubeVideoIds,
      openYouTubePlaylist,
      ytTimerDone,
      startPlaylistTimer,
      totalYouTubeDurationSec,
      updatePlaylistPresence,
    ],
  );

  const ensureAutoOpenOnce = useCallback(() => {
    if (youtubeVideoIds.length === 0) return;
    if (roundStatus !== "voting") return;
    const session = getRoundYouTubePlaylistSessionSnapshot(roundId);
    if (session.done || ytTimerDone) {
      syncTimerFromSession();
      return;
    }
    if (session.active) {
      syncTimerFromSession();
      updatePlaylistPresence(true);
      return;
    }
    startPlaylistTimer(totalYouTubeDurationSec);
    updatePlaylistPresence(true);
    openYouTubePlaylist(youtubeVideoIds);
  }, [
    roundId,
    youtubeVideoIds,
    roundStatus,
    ytTimerDone,
    openYouTubePlaylist,
    startPlaylistTimer,
    syncTimerFromSession,
    totalYouTubeDurationSec,
    updatePlaylistPresence,
  ]);

  useEffect(() => {
    if (!ytTimerRunning) {
      return;
    }
    updatePlaylistPresence(true);
    const heartbeat = window.setInterval(() => {
      updatePlaylistPresence(true);
    }, 30_000);

    return () => {
      window.clearInterval(heartbeat);
    };
  }, [ytTimerRunning, updatePlaylistPresence]);

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
