"use client";

import { RefObject, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import { getNextProgressSecondsToSync } from "@/lib/music/listen-progress";

type UseListenProgressSyncArgs = {
  audioRef: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  submissionId: Id<"submissions"> | null;
  enabled: boolean;
  serverProgressSeconds?: number;
};

export function useListenProgressSync({
  audioRef,
  isPlaying,
  submissionId,
  enabled,
  serverProgressSeconds = 0,
}: UseListenProgressSyncArgs) {
  const updateDbProgress = useMutation(api.listenProgress.updateProgress);
  const lastSyncedSubmissionRef = useRef<string | null>(null);
  const lastSyncedProgressRef = useRef(0);

  useEffect(() => {
    if (!submissionId) {
      lastSyncedSubmissionRef.current = null;
      lastSyncedProgressRef.current = 0;
      return;
    }

    const submissionKey = submissionId.toString();
    const normalizedServerProgress = Math.max(
      0,
      Math.floor(serverProgressSeconds),
    );

    if (lastSyncedSubmissionRef.current !== submissionKey) {
      lastSyncedSubmissionRef.current = submissionKey;
      lastSyncedProgressRef.current = normalizedServerProgress;
      return;
    }

    if (normalizedServerProgress > lastSyncedProgressRef.current) {
      lastSyncedProgressRef.current = normalizedServerProgress;
    }
  }, [submissionId, serverProgressSeconds]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!enabled || !isPlaying || !submissionId || !audioRef.current) {
        return;
      }
      const submissionKey = submissionId.toString();
      if (lastSyncedSubmissionRef.current !== submissionKey) {
        lastSyncedSubmissionRef.current = submissionKey;
        lastSyncedProgressRef.current = Math.max(
          0,
          Math.floor(serverProgressSeconds),
        );
      }

      const desiredProgressSeconds = Math.floor(audioRef.current.currentTime);
      if (desiredProgressSeconds <= 0) {
        return;
      }
      const durationSeconds = Number.isFinite(audioRef.current.duration)
        ? Math.floor(audioRef.current.duration)
        : 0;
      const progressSeconds = getNextProgressSecondsToSync({
        desiredProgressSeconds,
        lastSyncedProgressSeconds: lastSyncedProgressRef.current,
        durationSeconds,
      });
      if (progressSeconds === null) {
        return;
      }

      void updateDbProgress({
        submissionId,
        progressSeconds,
      })
        .then((result) => {
          lastSyncedProgressRef.current = Math.max(
            lastSyncedProgressRef.current,
            result?.progressSeconds ?? progressSeconds,
          );
        })
        .catch(console.error);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [
    audioRef,
    enabled,
    isPlaying,
    serverProgressSeconds,
    submissionId,
    updateDbProgress,
  ]);
}
