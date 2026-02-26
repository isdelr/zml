// hooks/useBrowserNotifier.ts
import { useState, useEffect, useCallback, useMemo } from "react";
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

export function useBrowserNotifier() {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "default";
    }
    return Notification.permission;
  });
  const shouldLoadCurrentUser = permission === "granted";
  const currentUser = useQuery(
    api.users.getCurrentUser,
    shouldLoadCurrentUser ? {} : "skip",
  );
  const subscribe = useMutation(api.webPush.subscribe);
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
    const createSubscription = async () => {
      if (
        permission === "granted" &&
        !!currentUser?._id &&
        "serviceWorker" in navigator &&
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      ) {
        try {
          const registration = await navigator.serviceWorker.ready;
          let subscription = await registration.pushManager.getSubscription();
          if (!subscription) {
            const applicationServerKey = urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!);
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey,
            });
          }

          const subscriptionJSON = subscription.toJSON();

          if (
            !subscriptionJSON.endpoint ||
            !subscriptionJSON.keys?.p256dh ||
            !subscriptionJSON.keys?.auth
          ) {
            console.error("Subscription is missing one or more required properties.");
            return;
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
        } catch (error) {
          console.error("Error subscribing to push notifications:", error);
        }
      }
    };
    void createSubscription();
  }, [permission, currentUser?._id, subscribe]);

  const isPromptVisible = useMemo(() => {
    return permission === "default" && !dontAskAgain && !isTemporarilyDismissed;
  }, [permission, dontAskAgain, isTemporarilyDismissed]);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.error("This browser does not support desktop notification");
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
    }
  }, []);

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
  };
}
