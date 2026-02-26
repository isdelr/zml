"use client";

import { useEffect, useState } from "react";

const AUTO_RETRY_DELAYS = [3_000, 6_000, 12_000];

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    if (attempt >= AUTO_RETRY_DELAYS.length) return;

    const timer = setTimeout(() => {
      setAttempt((a) => a + 1);
      reset();
    }, AUTO_RETRY_DELAYS[attempt]);

    return () => clearTimeout(timer);
  }, [attempt, reset]);

  const isAutoRetrying = attempt < AUTO_RETRY_DELAYS.length;

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {isAutoRetrying
          ? "Reconnecting automatically..."
          : "An unexpected error occurred. This is usually temporary — try again and it should work."}
      </p>
      {!isAutoRetrying && (
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
