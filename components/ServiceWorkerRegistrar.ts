"use client";
import { useEffect, useRef } from "react";
import { Serwist } from "@serwist/window";
import { toast } from "sonner";

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

    const RECOVERY_FLAG = "sw-precache-recovery-attempted";
    const recoverFromBrokenPrecache = async () => {
      if (sessionStorage.getItem(RECOVERY_FLAG) === "1") return;
      sessionStorage.setItem(RECOVERY_FLAG, "1");
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations
            .filter((registration) => {
              const candidate =
                registration.active ?? registration.waiting ?? registration.installing;
              if (!candidate) return false;
              return new URL(candidate.scriptURL).pathname.startsWith("/serwist/");
            })
            .map((registration) => registration.unregister()),
        );
      } catch (error) {
        console.error("[SW] Recovery failed while unregistering workers", error);
      } finally {
        window.location.reload();
      }
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
