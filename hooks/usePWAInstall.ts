// hooks/usePWAInstall.ts
"use client";
import { useState, useEffect, useCallback, useMemo } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const PWA_PROMPT_DISMISSED_KEY = "pwa-prompt-dismissed-timestamp";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function usePWAInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.matchMedia("(display-mode: standalone)").matches;
  });
  const [isTemporarilyDismissed, setIsTemporarilyDismissed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const timestamp = localStorage.getItem(PWA_PROMPT_DISMISSED_KEY);
    if (!timestamp) {
      return false;
    }
    const isStillDismissed =
      Date.now() - Number.parseInt(timestamp, 10) < DISMISS_DURATION;
    if (!isStillDismissed) {
      localStorage.removeItem(PWA_PROMPT_DISMISSED_KEY);
    }
    return isStillDismissed;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsAppInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const isBannerVisible = useMemo(() => {
    return !isAppInstalled && !!promptEvent && !isTemporarilyDismissed;
  }, [isAppInstalled, isTemporarilyDismissed, promptEvent]);

  const handleInstallClick = useCallback(async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      setIsAppInstalled(true);
      localStorage.removeItem(PWA_PROMPT_DISMISSED_KEY);
      setIsTemporarilyDismissed(false);
    }
    setPromptEvent(null);
  }, [promptEvent]);

  const handleDismissClick = useCallback(() => {
    const now = Date.now();
    localStorage.setItem(PWA_PROMPT_DISMISSED_KEY, now.toString());
    setIsTemporarilyDismissed(true);
  }, []);

  return { isBannerVisible, handleInstallClick, handleDismissClick };
}
