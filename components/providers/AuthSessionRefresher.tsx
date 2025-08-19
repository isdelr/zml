"use client";
import { useEffect, useRef } from "react";
import { useConvexAuth } from "convex/react";

// Keep the Next.js auth session warm and silently refresh auth cookies.
// Helps avoid "logged out after closing the PWA" on mobile.
export function AuthSessionRefresher() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const ping = async () => {
      try {
        // A tiny session endpoint that reads auth and responds.
        await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
      } catch {
        // ignore
      }
    };

    if (!isLoading) {
      void ping();
    }

    if (!isLoading && isAuthenticated) {
      const FIVE_MIN = 5 * 60 * 1000;
      intervalRef.current = window.setInterval(() => {
        void ping();
      }, FIVE_MIN);
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void ping();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, isLoading]);

  return null;
}