// hooks/usePWAInstall.ts
"use client";
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";

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
const MOBILE_INSTALL_BANNER_QUERY = "(max-width: 767px)";
const noopSubscribe = () => () => {};

export function usePWAInstall() {
  const isHydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
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
  const [canShowCustomBanner, setCanShowCustomBanner] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia(MOBILE_INSTALL_BANNER_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const displayModeMediaQuery = window.matchMedia("(display-mode: standalone)");
    const mobileBannerMediaQuery = window.matchMedia(MOBILE_INSTALL_BANNER_QUERY);

    const handleBannerViewportChange = (event: MediaQueryListEvent) => {
      setCanShowCustomBanner(event.matches);
    };
    const handleDisplayModeChange = (event: MediaQueryListEvent) => {
      setIsAppInstalled(event.matches);
    };
    const handleBeforeInstallPrompt = (e: Event) => {
      const shouldDeferPrompt =
        canShowCustomBanner && !isTemporarilyDismissed && !isAppInstalled;
      if (!shouldDeferPrompt) {
        setPromptEvent(null);
        return;
      }
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsAppInstalled(true);
    };
    displayModeMediaQuery.addEventListener("change", handleDisplayModeChange);
    mobileBannerMediaQuery.addEventListener("change", handleBannerViewportChange);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      displayModeMediaQuery.removeEventListener("change", handleDisplayModeChange);
      mobileBannerMediaQuery.removeEventListener("change", handleBannerViewportChange);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [canShowCustomBanner, isAppInstalled, isTemporarilyDismissed]);

  const isBannerVisible = useMemo(() => {
    return (
      isHydrated &&
      canShowCustomBanner &&
      !isAppInstalled &&
      !!promptEvent &&
      !isTemporarilyDismissed
    );
  }, [
    canShowCustomBanner,
    isHydrated,
    isAppInstalled,
    isTemporarilyDismissed,
    promptEvent,
  ]);

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
    setPromptEvent(null);
  }, []);

  return { isBannerVisible, handleInstallClick, handleDismissClick };
}
