"use client";

import { useEffect, useState } from "react";

const AUTO_RETRY_DELAYS = [3_000, 6_000, 12_000];

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          backgroundColor: "#201E1C",
          color: "#F2F0ED",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#a8a29e",
              marginBottom: "1.5rem",
              maxWidth: "24rem",
            }}
          >
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
              style={{
                padding: "0.625rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                backgroundColor: "#F2F0ED",
                color: "#201E1C",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          )}
        </div>
      </body>
    </html>
  );
}
