// hooks/useBrowserNotifier.ts
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex/api";

const DONT_ASK_AGAIN_KEY = "notification-permission-dont-ask";
const PROMPT_DISMISSED_KEY = "notification-permission-prompt-dismissed";
const PROMPT_DISMISSED_TIMEOUT = 7 * 24 * 60 * 60 * 1000;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getValidatedApplicationServerKey(vapidPublicKey: string) {
  const normalized = vapidPublicKey.trim();
  const applicationServerKey = urlBase64ToUint8Array(normalized);
  if (
    applicationServerKey.length !== 65 ||
    applicationServerKey[0] !== 0x04
  ) {
    throw new Error(
      `Invalid VAPID public key in client env. Expected 65-byte uncompressed P-256 key, received ${applicationServerKey.length} bytes.`,
    );
  }
  return applicationServerKey;
}

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

function isAppleMobileBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const { userAgent, platform, maxTouchPoints } = navigator;
  return (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const inDisplayModeStandalone = window.matchMedia(
    "(display-mode: standalone)",
  ).matches;
  const inLegacyIosStandalone = Boolean(
    (navigator as NavigatorWithStandalone).standalone,
  );
  return inDisplayModeStandalone || inLegacyIosStandalone;
}

async function syncSubscriptionToServer(
  subscription: PushSubscription,
  subscribe: ReturnType<typeof useMutation<typeof api.webPush.subscribe>>,
) {
  const subscriptionJSON = subscription.toJSON();

  if (
    !subscriptionJSON.endpoint ||
    !subscriptionJSON.keys?.p256dh ||
    !subscriptionJSON.keys?.auth
  ) {
    console.error("Subscription is missing one or more required properties.");
    return false;
  }

  await subscribe({
    endpoint: subscriptionJSON.endpoint,
    subscription: {
      keys: {
        p256dh: subscriptionJSON.keys.p256dh,
        auth: subscriptionJSON.keys.auth,
      },
    },
  });

  return true;
}

export function useBrowserNotifier() {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "default";
    }
    return Notification.permission;
  });
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const subscribe = useMutation(api.webPush.subscribe);
  const isSyncingSubscription = useRef(false);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const [isAppleMobile, setIsAppleMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return localStorage.getItem(DONT_ASK_AGAIN_KEY) === "true";
  });
  const [isTemporarilyDismissed, setIsTemporarilyDismissed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const timestamp = localStorage.getItem(PROMPT_DISMISSED_KEY);
    if (!timestamp) {
      return false;
    }
    const isStillDismissed =
      Date.now() - Number.parseInt(timestamp, 10) < PROMPT_DISMISSED_TIMEOUT;
    if (!isStillDismissed) {
      localStorage.removeItem(PROMPT_DISMISSED_KEY);
    }
    return isStillDismissed;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updatePlatformState = () => {
      setIsAppleMobile(isAppleMobileBrowser());
      setIsStandalone(isStandaloneDisplayMode());
    };

    updatePlatformState();

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const onMediaChange = () => updatePlatformState();
    mediaQuery.addEventListener("change", onMediaChange);
    window.addEventListener("focus", updatePlatformState);
    window.addEventListener("visibilitychange", updatePlatformState);

    return () => {
      mediaQuery.removeEventListener("change", onMediaChange);
      window.removeEventListener("focus", updatePlatformState);
      window.removeEventListener("visibilitychange", updatePlatformState);
    };
  }, []);

  const isPushSupported = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return (
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  }, []);
  const requiresIosInstallForPush = isAppleMobile && !isStandalone;

  const syncExistingPushSubscription = useCallback(async () => {
    if (isSyncingSubscription.current) {
      return false;
    }

    if (permission !== "granted") {
      return false;
    }

    if (!currentUser?._id) {
      return false;
    }

    if (!("serviceWorker" in navigator)) {
      console.error("[Push] Service workers are unavailable in this browser.");
      return false;
    }

    if (!vapidPublicKey) {
      console.error("[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing in the client bundle.");
      return false;
    }

    if (requiresIosInstallForPush) {
      return false;
    }

    isSyncingSubscription.current = true;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        return false;
      }

      return await syncSubscriptionToServer(subscription, subscribe);
    } catch (error) {
      console.error("[Push] Failed to sync existing subscription:", error, {
        permission,
        isSecureContext: typeof window !== "undefined" ? window.isSecureContext : false,
        origin: typeof window === "undefined" ? undefined : window.location.origin,
      });
      return false;
    } finally {
      isSyncingSubscription.current = false;
    }
  }, [
    currentUser?._id,
    permission,
    requiresIosInstallForPush,
    subscribe,
    vapidPublicKey,
  ]);

  useEffect(() => {
    if (permission !== "granted" || !currentUser?._id) {
      return;
    }
    void syncExistingPushSubscription();
  }, [currentUser?._id, permission, syncExistingPushSubscription]);

  const isPromptVisible = useMemo(() => {
    if (dontAskAgain || isTemporarilyDismissed) {
      return false;
    }

    if (requiresIosInstallForPush) {
      return true;
    }

    return permission === "default" && isPushSupported;
  }, [
    dontAskAgain,
    isPushSupported,
    isTemporarilyDismissed,
    permission,
    requiresIosInstallForPush,
  ]);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.error("This browser does not support desktop notification");
      return;
    }
    if (requiresIosInstallForPush) {
      console.warn(
        "[Push] Push permission on iPhone/iPad requires launching the installed Home Screen app first.",
      );
      return;
    }
    const currentPermission = await Notification.requestPermission();
    setPermission(currentPermission);
    if (currentPermission !== "granted") {
      const now = Date.now();
      localStorage.setItem(PROMPT_DISMISSED_KEY, now.toString());
      setIsTemporarilyDismissed(true);
    } else {
      localStorage.removeItem(DONT_ASK_AGAIN_KEY);
      localStorage.removeItem(PROMPT_DISMISSED_KEY);
      setDontAskAgain(false);
      setIsTemporarilyDismissed(false);
      try {
        const registration = await navigator.serviceWorker.ready;
        const applicationServerKey =
          getValidatedApplicationServerKey(vapidPublicKey ?? "");

        console.info("[Push] Attempting browser subscription", {
          isSecureContext,
          origin: window.location.origin,
          permission: currentPermission,
          scope: registration.scope,
          hasActiveWorker: Boolean(registration.active),
          vapidPublicKeyLength: vapidPublicKey?.length ?? 0,
          applicationServerKeyLength: applicationServerKey.length,
        });

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
        }

        await syncSubscriptionToServer(subscription, subscribe);
      } catch (error) {
        const errorName =
          error instanceof DOMException || error instanceof Error
            ? error.name
            : "UnknownError";
        const errorMessage =
          error instanceof Error
            ? error.message
            : String(error ?? "Unknown error");
        console.error("Error subscribing to push notifications:", error, {
          errorName,
          errorMessage,
          permission: currentPermission,
          isSecureContext,
          origin: window.location.origin,
          hasServiceWorker: "serviceWorker" in navigator,
          vapidPublicKeyLength: vapidPublicKey?.length ?? 0,
        });
      }
    }
  }, [requiresIosInstallForPush, subscribe, vapidPublicKey]);

  const showNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (permission === "granted") {
        new Notification(title, { icon: "/icons/favicon.ico", ...options });
      }
    },
    [permission],
  );

  const dismissPrompt = useCallback((permanent = false) => {
    if (permanent) {
      localStorage.setItem(DONT_ASK_AGAIN_KEY, "true");
      setDontAskAgain(true);
      setIsTemporarilyDismissed(false);
    } else {
      const now = Date.now();
      localStorage.setItem(PROMPT_DISMISSED_KEY, now.toString());
      setIsTemporarilyDismissed(true);
    }
  }, []);

  return {
    isPromptVisible,
    requestPermission,
    dismissPrompt,
    showNotification,
    permission,
    requiresIosInstallForPush,
  };
}
