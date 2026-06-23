// hooks/useBrowserNotifier.ts
"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex/api";

const DONT_ASK_AGAIN_KEY = "notification-permission-dont-ask";
const PROMPT_DISMISSED_KEY = "notification-permission-prompt-dismissed";
const PROMPT_DISMISSED_TIMEOUT = 7 * 24 * 60 * 60 * 1000;
const noopSubscribe = () => () => {};

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

function normalizeVapidPublicKey(vapidPublicKey: string) {
  return vapidPublicKey.replace(/\s+/g, "").trim();
}

function getValidatedApplicationServerKey(vapidPublicKey: string) {
  const normalized = normalizeVapidPublicKey(vapidPublicKey);
  if (!normalized) {
    throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing.");
  }
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(normalized)) {
    throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not valid base64url.");
  }
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

function bufferSourceToUint8Array(bufferSource: BufferSource | null) {
  if (!bufferSource) {
    return null;
  }
  if (bufferSource instanceof ArrayBuffer) {
    return new Uint8Array(bufferSource);
  }
  return new Uint8Array(
    bufferSource.buffer,
    bufferSource.byteOffset,
    bufferSource.byteLength,
  );
}

function applicationServerKeysMatch(
  subscription: PushSubscription,
  applicationServerKey: Uint8Array,
) {
  const existingKey = bufferSourceToUint8Array(
    subscription.options.applicationServerKey,
  );
  if (!existingKey || existingKey.length !== applicationServerKey.length) {
    return false;
  }

  return existingKey.every((byte, index) => byte === applicationServerKey[index]);
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
  applicationServerKey: string,
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
    applicationServerKey,
    subscription: {
      keys: {
        p256dh: subscriptionJSON.keys.p256dh,
        auth: subscriptionJSON.keys.auth,
      },
    },
  });

  return true;
}

async function unsubscribeStaleSubscription(
  subscription: PushSubscription,
  unsubscribe: ReturnType<typeof useMutation<typeof api.webPush.unsubscribe>>,
) {
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch((error) => {
    console.warn("[Push] Browser unsubscribe failed:", error);
  });

  if (!endpoint) {
    return;
  }

  await unsubscribe({ endpoint }).catch((error) => {
    console.warn("[Push] Failed to remove stale subscription from server:", error);
  });
}

export function useBrowserNotifier() {
  const isHydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "default";
    }
    return Notification.permission;
  });
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const subscribe = useMutation(api.webPush.subscribe);
  const unsubscribe = useMutation(api.webPush.unsubscribe);
  const isSyncingSubscription = useRef(false);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const normalizedVapidPublicKey = useMemo(
    () => normalizeVapidPublicKey(vapidPublicKey),
    [vapidPublicKey],
  );
  const applicationServerKey = useMemo(() => {
    if (!isHydrated) {
      return null;
    }
    try {
      return getValidatedApplicationServerKey(normalizedVapidPublicKey);
    } catch (error) {
      console.error("[Push] Invalid VAPID public key:", error);
      return null;
    }
  }, [isHydrated, normalizedVapidPublicKey]);
  const [isAppleMobile, setIsAppleMobile] = useState(() => isAppleMobileBrowser());
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneDisplayMode());
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
    if (!isHydrated || typeof window === "undefined") {
      return false;
    }

    return (
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  }, [isHydrated]);
  const requiresIosInstallForPush = isAppleMobile && !isStandalone;

  const ensurePushSubscription = useCallback(async () => {
    if (!currentUser?._id) {
      return false;
    }

    if (!("serviceWorker" in navigator)) {
      console.error("[Push] Service workers are unavailable in this browser.");
      return false;
    }

    if (!applicationServerKey || !normalizedVapidPublicKey) {
      console.error("[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing or invalid.");
      return false;
    }

    if (requiresIosInstallForPush) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (
      subscription &&
      !applicationServerKeysMatch(subscription, applicationServerKey)
    ) {
      console.info("[Push] Existing subscription uses an old VAPID key. Re-subscribing.");
      await unsubscribeStaleSubscription(subscription, unsubscribe);
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    return await syncSubscriptionToServer(
      subscription,
      subscribe,
      normalizedVapidPublicKey,
    );
  }, [
    applicationServerKey,
    currentUser?._id,
    normalizedVapidPublicKey,
    requiresIosInstallForPush,
    subscribe,
    unsubscribe,
  ]);

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

    isSyncingSubscription.current = true;

    try {
      return await ensurePushSubscription();
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
    ensurePushSubscription,
    permission,
  ]);

  useEffect(() => {
    if (permission !== "granted" || !currentUser?._id) {
      return;
    }
    void syncExistingPushSubscription();
  }, [currentUser?._id, permission, syncExistingPushSubscription]);

  const isPromptVisible = useMemo(() => {
    if (!isHydrated) {
      return false;
    }

    if (dontAskAgain || isTemporarilyDismissed) {
      return false;
    }

    if (requiresIosInstallForPush) {
      return true;
    }

    return permission === "default" && isPushSupported && Boolean(applicationServerKey);
  }, [
    applicationServerKey,
    dontAskAgain,
    isHydrated,
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
    if (!applicationServerKey) {
      console.error("[Push] Cannot request push permission without a valid VAPID public key.");
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
        console.info("[Push] Attempting browser subscription", {
          isSecureContext,
          origin: window.location.origin,
          permission: currentPermission,
          vapidPublicKeyLength: normalizedVapidPublicKey.length,
          applicationServerKeyLength: applicationServerKey.length,
        });

        await ensurePushSubscription();
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
          vapidPublicKeyLength: normalizedVapidPublicKey.length,
        });
      }
    }
  }, [
    applicationServerKey,
    ensurePushSubscription,
    normalizedVapidPublicKey.length,
    requiresIosInstallForPush,
  ]);

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
