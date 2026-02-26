"use client";
import { useEffect, useRef, useCallback } from "react";
import { useAction, useConvexAuth } from "convex/react";
import { api } from "@/lib/convex/api";

export function AuthSessionRefresher() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const syncCachedAvatar = useAction(api.users.syncCachedAvatar);
  const intervalRef = useRef<number | null>(null);
  const isRefreshingRef = useRef(false);
  const isSyncingAvatarRef = useRef(false);

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

      if (response.ok) {
        localStorage.setItem("lastAuthPing", Date.now().toString());
      }
    } catch (error) {
      console.debug("Session ping failed:", error);
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  const syncAvatar = useCallback(async () => {
    if (isSyncingAvatarRef.current) return;

    isSyncingAvatarRef.current = true;
    try {
      await syncCachedAvatar({});
    } catch (error) {
      console.debug("Avatar sync failed:", error);
    } finally {
      isSyncingAvatarRef.current = false;
    }
  }, [syncCachedAvatar]);

  const setupInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (isAuthenticated) {
      const PING_INTERVAL = 2 * 60 * 1000; // 2 minutes
      intervalRef.current = window.setInterval(ping, PING_INTERVAL);
    }
  }, [isAuthenticated, ping]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void ping();
      void syncAvatar();
      setupInterval();
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && isAuthenticated) {
        const lastPing = localStorage.getItem("lastAuthPing");
        const now = Date.now();
        const OFFLINE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

        if (!lastPing || now - parseInt(lastPing) > OFFLINE_THRESHOLD) {
          void ping();
          void syncAvatar();
        }

        setupInterval();
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
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
  }, [isAuthenticated, isLoading, setupInterval, ping, syncAvatar]);

  return null;
}
