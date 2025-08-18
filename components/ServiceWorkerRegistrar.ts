"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

// Register the service worker for all users in production.
// Handle updates via skipWaiting and refresh the page once.
export function ServiceWorkerRegistrar() {
  const updateNotified = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // Best effort: ask for persistent storage
        if ("storage" in navigator && "persist" in navigator.storage) {
          try {
            await (navigator.storage).persist?.();
          } catch {}
        }

        if (registration.waiting && !updateNotified.current) {
          updateNotified.current = true;
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration?.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed") {
              if (navigator.serviceWorker.controller && !updateNotified.current) {
                updateNotified.current = true;
                toast.info("A new version is available. Updating…");
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            }
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!updateNotified.current) {
            updateNotified.current = true;
            window.location.reload();
          }
        });
      } catch (error) {
        console.error("[SW] Registration failed:", error);
      }
    };

    void register();
  }, []);

  return null;
}