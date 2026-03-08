"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/lib/convex/api";
import { buildYouTubeWatchVideosUrl } from "@/lib/youtube";
import { openUrlInNewTabWithFallback } from "@/lib/music/youtube-playlist-session";

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
  const serverSession = useQuery(api.listenProgress.getYouTubePlaylistSession, {
    roundId,
  });
  const startPlaylistSession = useMutation(
    api.listenProgress.startYouTubePlaylistSession,
  );
  const completePlaylistSession = useMutation(
    api.listenProgress.completeYouTubePlaylistSession,
  );
  const updatePresence = useMutation(api.presence.update);

  const [ytTimerRemainingSec, setYtTimerRemainingSec] = useState<number>(0);
  const [ytTimerRunning, setYtTimerRunning] = useState<boolean>(false);
  const [ytTimerDone, setYtTimerDone] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);
  const completionInFlightRef = useRef(false);

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
    if (completionInFlightRef.current) {
      return;
    }

    completionInFlightRef.current = true;

    try {
      const result = await completePlaylistSession({
        roundId,
        submissionIds: youtubeSubmissionIds,
      });

      setYtTimerDone(result.done);
      setYtTimerRunning(result.active);
      setYtTimerRemainingSec(result.remainingSec);

      if (result.done) {
        clearTimer();
        updatePlaylistPresence(false);
        youtubeSubmissionIds.forEach((id) => onMarkCompletedLocal?.(id));
      }
    } catch (error) {
      console.error("Failed to mark playlist listening complete", error);
    } finally {
      completionInFlightRef.current = false;
    }
  }, [
    clearTimer,
    completePlaylistSession,
    onMarkCompletedLocal,
    roundId,
    updatePlaylistPresence,
    youtubeSubmissionIds,
  ]);

  useEffect(() => {
    if (!serverSession) {
      return;
    }

    if (serverSession.done) {
      clearTimer();
      setYtTimerDone(true);
      setYtTimerRunning(false);
      setYtTimerRemainingSec(0);
      updatePlaylistPresence(false);
      return;
    }

    if (serverSession.readyToComplete) {
      clearTimer();
      setYtTimerDone(false);
      setYtTimerRunning(false);
      setYtTimerRemainingSec(0);
      void completeYouTubeListening();
      return;
    }

    if (serverSession.active && serverSession.endAt) {
      const endAt = serverSession.endAt;
      setYtTimerDone(false);
      setYtTimerRunning(true);
      setYtTimerRemainingSec(serverSession.remainingSec);
      clearTimer();
      timerRef.current = window.setInterval(() => {
        const remainingSec = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
        setYtTimerRemainingSec(remainingSec);
        if (remainingSec <= 0) {
          clearTimer();
          void completeYouTubeListening();
        }
      }, 1000);
      return;
    }

    clearTimer();
    setYtTimerDone(false);
    setYtTimerRunning(false);
    setYtTimerRemainingSec(0);
  }, [clearTimer, completeYouTubeListening, serverSession, updatePlaylistPresence]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const openYouTubePlaylist = useCallback((orderedIds: string[]) => {
    const url = buildYouTubeWatchVideosUrl(orderedIds);
    if (!url) return;
    openUrlInNewTabWithFallback(url);
  }, []);

  const openPlaylistAndStart = useCallback(
    (orderedIds?: string[]) => {
      const ids = orderedIds && orderedIds.length > 0 ? orderedIds : youtubeVideoIds;
      if (ids.length === 0) return;

      void (async () => {
        let nextSession = serverSession;
        if (!serverSession?.done) {
          try {
            nextSession = await startPlaylistSession({
              roundId,
              durationSec: totalYouTubeDurationSec,
            });
          } catch (error) {
            console.error("Failed to start YouTube playlist session", error);
          }
        }

        if (nextSession?.readyToComplete) {
          await completeYouTubeListening();
          return;
        }

        updatePlaylistPresence(true);
        openYouTubePlaylist(ids);
      })();
    },
    [
      completeYouTubeListening,
      openYouTubePlaylist,
      roundId,
      serverSession,
      startPlaylistSession,
      totalYouTubeDurationSec,
      updatePlaylistPresence,
      youtubeVideoIds,
    ],
  );

  const ensureAutoOpenOnce = useCallback(() => {
    if (youtubeVideoIds.length === 0) return;
    if (roundStatus !== "voting") return;
    if (serverSession?.done) {
      clearTimer();
      setYtTimerDone(true);
      setYtTimerRunning(false);
      setYtTimerRemainingSec(0);
      return;
    }
    if (serverSession?.active) {
      updatePlaylistPresence(true);
      return;
    }
    if (serverSession?.readyToComplete) {
      void completeYouTubeListening();
      return;
    }
    openPlaylistAndStart(youtubeVideoIds);
  }, [
    clearTimer,
    completeYouTubeListening,
    openPlaylistAndStart,
    roundStatus,
    serverSession?.active,
    serverSession?.done,
    serverSession?.readyToComplete,
    updatePlaylistPresence,
    youtubeVideoIds,
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
