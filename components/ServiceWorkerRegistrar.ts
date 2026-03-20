"use client";
import { useEffect, useRef } from "react";
import { Serwist } from "@serwist/window";
import { toast } from "sonner";
import { recoverFromStaleClient } from "@/lib/stale-client-recovery";

declare global {
  interface Window {
    serwist?: Serwist;
  }
}

// Register the service worker for all users in production.
// Handle updates via skipWaiting and refresh the page once.
export function ServiceWorkerRegistrar() {
  const updateNotified = useRef(false);
  const reloadTriggered = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    if (!window.serwist) {
      window.serwist = new Serwist("/serwist/sw.js", {
        scope: "/",
        type: "module",
        updateViaCache: "none",
      });
    }
    const serwist = window.serwist;

    const recoverFromBrokenPrecache = async () => {
      await recoverFromStaleClient({
        key: "sw-precache",
        error: new Error("bad-precaching-response"),
        unregisterServiceWorkers: true,
      });
    };

    const onWaiting = () => {
      if (updateNotified.current) return;
      updateNotified.current = true;
      toast.info("A new version is available. Updating…");
      serwist.messageSkipWaiting();
    };

    const onControlling = () => {
      if (reloadTriggered.current) return;
      reloadTriggered.current = true;
      window.location.reload();
    };

    serwist.addEventListener("waiting", onWaiting);
    serwist.addEventListener("controlling", onControlling);

    void serwist.register().catch((error) => {
      const message =
        error instanceof Error ? error.message : String(error ?? "Unknown error");
      console.error("[SW] Registration failed", error);
      if (message.includes("bad-precaching-response")) {
        void recoverFromBrokenPrecache();
      }
    });

    // Listen for precache error messages posted by the SW's own
    // unhandledrejection handler (SW-thread errors don't fire on window).
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_PRECACHE_ERROR") {
        void recoverFromBrokenPrecache();
      }
    };
    navigator.serviceWorker.addEventListener("message", onSwMessage);

    // Best effort: ask for persistent storage
    if ("storage" in navigator && "persist" in navigator.storage) {
      void navigator.storage.persist().catch(() => undefined);
    }

    return () => {
      serwist.removeEventListener("waiting", onWaiting);
      serwist.removeEventListener("controlling", onControlling);
      navigator.serviceWorker.removeEventListener("message", onSwMessage);
    };
  }, []);

  return null;
}
