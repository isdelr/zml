"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/lib/convex/api";
import { type PlaylistListenUnlock } from "@/lib/music/listen-progress";
import { buildYouTubeWatchVideosUrl } from "@/lib/youtube";
import { openUrlInNewTabWithFallback } from "@/lib/music/youtube-playlist-session";

type UseRoundYouTubePlaylistArgs = {
  roundId: Id<"rounds">;
  roundStatus: string;
  youtubeVideoIds: string[];
  youtubeUnlocks: PlaylistListenUnlock<Id<"submissions">>[];
  totalYouTubeDurationSec: number;
  presenceEnabled?: boolean;
  onPresenceStart?: () => void;
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

type PlaylistSessionState = {
  active: boolean;
  done: boolean;
  readyToComplete: boolean;
  startedAt?: number | null;
  endAt: number | null;
  remainingSec: number;
};

export function useRoundYouTubePlaylist({
  roundId,
  roundStatus,
  youtubeVideoIds,
  youtubeUnlocks,
  totalYouTubeDurationSec,
  presenceEnabled = true,
  onPresenceStart,
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
  const locallyUnlockedSubmissionIdsRef = useRef<Set<string>>(new Set());

  const allYouTubeSubmissionIds = youtubeUnlocks.flatMap(
    (entry) => entry.submissionIds,
  );

  const updatePlaylistPresence = useCallback(
    (active: boolean) => {
      if (active && !presenceEnabled) {
        onPresenceStart?.();
      }
      const args = active ? { listeningTo: null, roundId } : { listeningTo: null };
      void updatePresence(args).catch((error: unknown) => {
        console.warn("[presence:youtube-playlist] non-fatal failure", error);
      });
    },
    [onPresenceStart, presenceEnabled, roundId, updatePresence],
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const syncLocallyUnlockedSubmissions = useCallback(
    (elapsedSeconds: number, markAllAsCompleted = false) => {
      const nextUnlockedSubmissionIds = markAllAsCompleted
        ? allYouTubeSubmissionIds
        : youtubeUnlocks
            .filter((entry) => elapsedSeconds >= entry.unlockAfterSeconds)
            .flatMap((entry) => entry.submissionIds);
      const nextUnlockedIdSet = new Set(
        nextUnlockedSubmissionIds.map((submissionId) => submissionId.toString()),
      );
      const previousUnlockedIdSet = locallyUnlockedSubmissionIdsRef.current;

      nextUnlockedSubmissionIds.forEach((submissionId) => {
        if (!previousUnlockedIdSet.has(submissionId.toString())) {
          onMarkCompletedLocal?.(submissionId);
        }
      });

      locallyUnlockedSubmissionIdsRef.current = nextUnlockedIdSet;
    },
    [allYouTubeSubmissionIds, onMarkCompletedLocal, youtubeUnlocks],
  );

  const completeYouTubeListening = useCallback(async () => {
    if (completionInFlightRef.current) {
      return;
    }

    completionInFlightRef.current = true;

    try {
      const result = await completePlaylistSession({
        roundId,
        submissionIds: allYouTubeSubmissionIds,
      });

      setYtTimerDone(result.done);
      setYtTimerRunning(result.active);
      setYtTimerRemainingSec(result.remainingSec);

      if (result.done) {
        clearTimer();
        if (presenceEnabled) {
          updatePlaylistPresence(false);
        }
        syncLocallyUnlockedSubmissions(totalYouTubeDurationSec, true);
      }
    } catch (error) {
      console.error("Failed to mark playlist listening complete", error);
    } finally {
      completionInFlightRef.current = false;
    }
  }, [
    clearTimer,
    completePlaylistSession,
    roundId,
    allYouTubeSubmissionIds,
    syncLocallyUnlockedSubmissions,
    totalYouTubeDurationSec,
    presenceEnabled,
    updatePlaylistPresence,
  ]);

  const startLocalTimer = useCallback(
    (startedAt: number, endAt: number, initialRemainingSec: number) => {
      setYtTimerDone(false);
      setYtTimerRunning(true);
      setYtTimerRemainingSec(Math.max(0, initialRemainingSec));
      syncLocallyUnlockedSubmissions(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      );
      clearTimer();
      timerRef.current = window.setInterval(() => {
        const now = Date.now();
        const remainingSec = Math.max(0, Math.ceil((endAt - now) / 1000));
        setYtTimerRemainingSec(remainingSec);
        syncLocallyUnlockedSubmissions(
          Math.max(0, Math.floor((now - startedAt) / 1000)),
        );
        if (remainingSec <= 0) {
          clearTimer();
          void completeYouTubeListening();
        }
      }, 1000);
    },
    [clearTimer, completeYouTubeListening, syncLocallyUnlockedSubmissions],
  );

  const syncLocalSessionState = useCallback(
    (session: PlaylistSessionState | null | undefined) => {
      if (!session) {
        return;
      }

      if (session.done) {
        clearTimer();
        setYtTimerDone(true);
        setYtTimerRunning(false);
        setYtTimerRemainingSec(0);
        syncLocallyUnlockedSubmissions(totalYouTubeDurationSec, true);
        if (presenceEnabled) {
          updatePlaylistPresence(false);
        }
        return;
      }

      if (session.readyToComplete) {
        clearTimer();
        setYtTimerDone(false);
        setYtTimerRunning(false);
        setYtTimerRemainingSec(0);
        void completeYouTubeListening();
        return;
      }

      if (session.active && session.endAt && session.startedAt) {
        startLocalTimer(session.startedAt, session.endAt, session.remainingSec);
        return;
      }

      clearTimer();
      setYtTimerDone(false);
      setYtTimerRunning(false);
      setYtTimerRemainingSec(0);
      locallyUnlockedSubmissionIdsRef.current = new Set();
    },
    [
      clearTimer,
      completeYouTubeListening,
      startLocalTimer,
      syncLocallyUnlockedSubmissions,
      totalYouTubeDurationSec,
      presenceEnabled,
      updatePlaylistPresence,
    ],
  );

  useEffect(() => {
    syncLocalSessionState(serverSession);
  }, [serverSession, syncLocalSessionState]);

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

        syncLocalSessionState(nextSession);

        if (nextSession?.readyToComplete) {
          return;
        }

        if (!nextSession?.done) {
          updatePlaylistPresence(true);
        }

        openYouTubePlaylist(ids);
      })();
    },
    [
      openYouTubePlaylist,
      roundId,
      serverSession,
      startPlaylistSession,
      syncLocalSessionState,
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
    if (!ytTimerRunning || !presenceEnabled) {
      return;
    }
    updatePlaylistPresence(true);
    const heartbeat = window.setInterval(() => {
      updatePlaylistPresence(true);
    }, 30_000);

    return () => {
      window.clearInterval(heartbeat);
    };
  }, [presenceEnabled, ytTimerRunning, updatePlaylistPresence]);

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
