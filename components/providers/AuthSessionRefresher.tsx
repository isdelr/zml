"use client";
import { useEffect, useEffectEvent, useRef } from "react";
import { useConvexAuth } from "convex/react";

export function AuthSessionRefresher() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const intervalRef = useRef<number | null>(null);
  const lastPingAtRef = useRef(0);
  const isRefreshingRef = useRef(false);

  const clearPingInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const ping = useEffectEvent(async (force = false) => {
    if (!force && (document.visibilityState !== "visible" || !navigator.onLine)) {
      return;
    }
    if (isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (response.ok) {
        lastPingAtRef.current = Date.now();
      }
    } catch (error) {
      console.debug("Session ping failed:", error);
    } finally {
      isRefreshingRef.current = false;
    }
  });

  useEffect(() => {
    clearPingInterval();

    if (isLoading || !isAuthenticated) {
      return clearPingInterval;
    }

    const PING_INTERVAL = 2 * 60 * 1000;
    const OFFLINE_THRESHOLD = 5 * 60 * 1000;

    void ping(true);
    intervalRef.current = window.setInterval(() => {
      void ping();
    }, PING_INTERVAL);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && isAuthenticated) {
        const now = Date.now();

        if (now - lastPingAtRef.current > OFFLINE_THRESHOLD) {
          void ping();
        }
      } else {
        clearPingInterval();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onVisibilityChange);
      clearPingInterval();
    };
  }, [isAuthenticated, isLoading]);

  return null;
}
