"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";
import {
  hasRecoveryAttempted,
  isChunkLoadError,
  recoverFromStaleClient,
} from "@/lib/stale-client-recovery";

const AUTO_RETRY_DELAYS = [3_000, 6_000, 12_000];

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const isChunkError = isChunkLoadError(error);
  const chunkRecoveryAlreadyAttempted =
    isChunkError &&
    hasRecoveryAttempted({
      key: "chunk-load",
      error,
    });

  useEffect(() => {
    if (isChunkError && !chunkRecoveryAlreadyAttempted) {
      return;
    }

    console.error(error);
    Sentry.captureException(error, {
      tags: {
        boundary: "app-error",
      },
    });
  }, [chunkRecoveryAlreadyAttempted, error, isChunkError]);

  useEffect(() => {
    if (!isChunkError) return;

    void recoverFromStaleClient({
      key: "chunk-load",
      error,
      unregisterServiceWorkers: true,
    });
  }, [error, isChunkError]);

  useEffect(() => {
    if (isChunkError) return;
    if (attempt >= AUTO_RETRY_DELAYS.length) return;

    const timer = setTimeout(() => {
      setAttempt((a) => a + 1);
      reset();
    }, AUTO_RETRY_DELAYS[attempt]);

    return () => clearTimeout(timer);
  }, [attempt, isChunkError, reset]);

  const isAutoRetrying = !isChunkError && attempt < AUTO_RETRY_DELAYS.length;

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {isChunkError
          ? "Refreshing to recover the latest app version..."
          : isAutoRetrying
          ? "Reconnecting automatically..."
          : "An unexpected error occurred. This is usually temporary — try again and it should work."}
      </p>
      {!isAutoRetrying && !isChunkError && (
        <button
          onClick={() => {
            setAttempt(0);
            reset();
          }}
          className="mt-6 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Try again
        </button>
      )}
    </div>
  );
}
