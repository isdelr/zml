"use client";

import { RefObject, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";

type UseListenProgressSyncArgs = {
  audioRef: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  submissionId: Id<"submissions"> | null;
  enabled: boolean;
};

export function useListenProgressSync({
  audioRef,
  isPlaying,
  submissionId,
  enabled,
}: UseListenProgressSyncArgs) {
  const updateDbProgress = useMutation(api.listenProgress.updateProgress);
  const lastSyncedSubmissionRef = useRef<string | null>(null);
  const lastSyncedProgressRef = useRef(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!enabled || !isPlaying || !submissionId || !audioRef.current) {
        return;
      }
      const submissionKey = submissionId.toString();
      if (lastSyncedSubmissionRef.current !== submissionKey) {
        lastSyncedSubmissionRef.current = submissionKey;
        lastSyncedProgressRef.current = 0;
      }

      const progressSeconds = Math.floor(audioRef.current.currentTime);
      if (progressSeconds <= 0) {
        return;
      }
      const audioDuration = Number.isFinite(audioRef.current.duration)
        ? Math.floor(audioRef.current.duration)
        : 0;
      const progressedEnough = progressSeconds - lastSyncedProgressRef.current >= 15;
      const nearEnd = audioDuration > 0 && audioDuration - progressSeconds <= 5;
      if (!progressedEnough && !nearEnd) {
        return;
      }

      void updateDbProgress({
        submissionId,
        progressSeconds,
      })
        .then(() => {
          lastSyncedProgressRef.current = progressSeconds;
        })
        .catch(console.error);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [enabled, isPlaying, submissionId, audioRef, updateDbProgress]);
}
