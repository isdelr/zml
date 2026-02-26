"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";

type UseListeningPresenceArgs = {
  isPlaying: boolean;
  submissionId: Id<"submissions"> | null;
};

const PRESENCE_HEARTBEAT_MS = 30_000;

export function useListeningPresence({
  isPlaying,
  submissionId,
}: UseListeningPresenceArgs) {
  const updatePresence = useMutation(api.presence.update);
  const lastSentRef = useRef<Id<"submissions"> | null | undefined>(undefined);
  const updatePresenceSafely = useCallback(
    (listeningTo: Id<"submissions"> | null) => {
      void updatePresence({ listeningTo }).catch((error: unknown) => {
        console.warn("[presence:update] non-fatal failure", error);
      });
    },
    [updatePresence],
  );

  useEffect(() => {
    const desiredListeningTo = isPlaying && submissionId ? submissionId : null;
    if (lastSentRef.current !== desiredListeningTo) {
      lastSentRef.current = desiredListeningTo;
      updatePresenceSafely(desiredListeningTo);
    }
  }, [isPlaying, submissionId, updatePresenceSafely]);

  useEffect(() => {
    if (!(isPlaying && submissionId)) {
      return;
    }
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      updatePresenceSafely(submissionId);
    }, PRESENCE_HEARTBEAT_MS);

    return () => {
      clearInterval(heartbeat);
    };
  }, [isPlaying, submissionId, updatePresenceSafely]);

  useEffect(() => {
    return () => {
      if (lastSentRef.current === null || lastSentRef.current === undefined) {
        return;
      }
      lastSentRef.current = null;
      updatePresenceSafely(null);
    };
  }, [updatePresenceSafely]);
}
