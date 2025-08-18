// hooks/useBrowserNotifier.ts
import { useState, useEffect, useCallback } from "react";
import { subscribeUser } from "@/app/actions";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

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
  const currentUser = useQuery(api.users.getCurrentUser);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isPromptVisible, setIsPromptVisible] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    const createSubscription = async () => {
      if (
        permission === "granted" &&
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
            !currentUser?._id ||
            !subscriptionJSON.endpoint ||
            !subscriptionJSON.keys?.p256dh ||
            !subscriptionJSON.keys?.auth
          ) {
            console.error("Subscription is missing one or more required properties.");
            return;
          }

          const subscriptionToSend = {
            userId: currentUser._id,
            endpoint: subscriptionJSON.endpoint,
            keys: {
              p256dh: subscriptionJSON.keys.p256dh,
              auth: subscriptionJSON.keys.auth,
            },
          };

          await subscribeUser(subscriptionToSend);
        } catch (error) {
          console.error("Error subscribing to push notifications:", error);
        }
      }
    };
    void createSubscription();
  }, [permission, currentUser?._id]);

  useEffect(() => {
    if (permission === "default") {
      const dontAsk = localStorage.getItem(DONT_ASK_AGAIN_KEY);
      if (dontAsk === "true") {
        setIsPromptVisible(false);
        return;
      }
      const dismissedTimestamp = localStorage.getItem(PROMPT_DISMISSED_KEY);
      if (dismissedTimestamp) {
        if (Date.now() - parseInt(dismissedTimestamp, 10) < PROMPT_DISMISSED_TIMEOUT) {
          setIsPromptVisible(false);
          return;
        }
      }
      setIsPromptVisible(true);
    } else {
      setIsPromptVisible(false);
    }
  }, [permission]);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.error("This browser does not support desktop notification");
      return;
    }
    const currentPermission = await Notification.requestPermission();
    setPermission(currentPermission);
    setIsPromptVisible(false);
    if (currentPermission !== "granted") {
      localStorage.setItem(PROMPT_DISMISSED_KEY, Date.now().toString());
    } else {
      localStorage.removeItem(DONT_ASK_AGAIN_KEY);
      localStorage.removeItem(PROMPT_DISMISSED_KEY);
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
    } else {
      localStorage.setItem(PROMPT_DISMISSED_KEY, Date.now().toString());
    }
    setIsPromptVisible(false);
  }, []);

  return {
    isPromptVisible,
    requestPermission,
    dismissPrompt,
    showNotification,
    permission,
  };
}
