// hooks/usePWAInstall.ts
"use client";
import { useState, useEffect, useCallback } from "react";

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
  const [isAppInstalled, setIsAppInstalled] = useState(true);
  const [isBannerVisible, setIsBannerVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      setIsAppInstalled(isStandalone);
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setPromptEvent(e as BeforeInstallPromptEvent);
      };
      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      };
    }
  }, []);

  useEffect(() => {
    if (isAppInstalled || !promptEvent) {
      setIsBannerVisible(false);
      return;
    }
    const dismissedTimestamp = localStorage.getItem(PWA_PROMPT_DISMISSED_KEY);
    if (dismissedTimestamp && Date.now() - parseInt(dismissedTimestamp, 10) < DISMISS_DURATION) {
      setIsBannerVisible(false);
    } else {
      setIsBannerVisible(true);
    }
  }, [promptEvent, isAppInstalled]);

  const handleInstallClick = useCallback(async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      setIsAppInstalled(true);
    }
    setPromptEvent(null);
    setIsBannerVisible(false);
  }, [promptEvent]);

  const handleDismissClick = useCallback(() => {
    localStorage.setItem(PWA_PROMPT_DISMISSED_KEY, Date.now().toString());
    setIsBannerVisible(false);
  }, []);

  return { isBannerVisible, handleInstallClick, handleDismissClick };
}
