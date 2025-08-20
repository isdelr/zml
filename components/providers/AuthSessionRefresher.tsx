"use client";
import { useEffect, useRef, useCallback } from "react";
import { useConvexAuth } from "convex/react";

// Enhanced session refresher with better PWA support
export function AuthSessionRefresher() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const intervalRef = useRef<number | null>(null);
  const isRefreshingRef = useRef(false);

  const ping = useCallback(async () => {
    if (isRefreshingRef.current) return;

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

      // Store last successful ping timestamp
      if (response.ok) {
        localStorage.setItem("lastAuthPing", Date.now().toString());
      }
    } catch (error) {
      console.debug("Session ping failed:", error);
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  const setupInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (isAuthenticated) {
      // More frequent pings for PWA
      const PING_INTERVAL = 2 * 60 * 1000; // 2 minutes
      intervalRef.current = window.setInterval(ping, PING_INTERVAL);
    }
  }, [isAuthenticated, ping]);

  useEffect(() => {
    if (!isLoading) {
      void ping();
    }

    if (!isLoading && isAuthenticated) {
      setupInterval();
    }

    // Handle page visibility changes
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Check if we've been away for too long
        const lastPing = localStorage.getItem("lastAuthPing");
        const now = Date.now();
        const OFFLINE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

        if (!lastPing || now - parseInt(lastPing) > OFFLINE_THRESHOLD) {
          void ping();
        }

        // Restart interval when app becomes visible
        if (isAuthenticated) {
          setupInterval();
        }
      } else {
        // Clear interval when app goes to background to save resources
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    // Handle app focus/blur for PWA
    const onFocus = () => {
      if (isAuthenticated) {
        void ping();
        setupInterval();
      }
    };

    const onBeforeUnload = () => {
      // Store timestamp before app closes
      localStorage.setItem("lastAuthPing", Date.now().toString());
    };

    // Handle PWA app state changes
    const onAppStateChange = () => {
      if (document.visibilityState === "visible" && isAuthenticated) {
        void ping();
        setupInterval();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onBeforeUnload);

    // PWA specific events
    window.addEventListener("appinstalled", onAppStateChange);
    document.addEventListener("resume", onAppStateChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onBeforeUnload);
      window.removeEventListener("appinstalled", onAppStateChange);
      document.removeEventListener("resume", onAppStateChange);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, isLoading, setupInterval, ping]);

  return null;
}