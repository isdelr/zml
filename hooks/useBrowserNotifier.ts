// hooks/useBrowserNotifier.ts

import { useState, useEffect, useCallback } from "react";
// NEW: Import the server action to save the subscription
import { subscribeUser } from "@/app/actions";

const DONT_ASK_AGAIN_KEY = "notification-permission-dont-ask";
const PROMPT_DISMISSED_KEY = "notification-permission-prompt-dismissed";
const PROMPT_DISMISSED_TIMEOUT = 7 * 24 * 60 * 60 * 1000;

// NEW: Helper function to format the VAPID public key
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
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isPromptVisible, setIsPromptVisible] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // --- START OF NEW CODE BLOCK ---
  // This new useEffect is the core of the solution. It runs when permission
  // is granted and handles the entire push subscription process.
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
            console.log("No existing subscription, creating new one...");
            const applicationServerKey = urlBase64ToUint8Array(
              process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
            );
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey,
            });
          } else {
            console.log("Found existing subscription.");
          }
          const subscriptionJSON = subscription.toJSON();

          // Perform a robust check to ensure all necessary parts exist.
          if (
            !subscriptionJSON.endpoint ||
            !subscriptionJSON.keys?.p256dh ||
            !subscriptionJSON.keys?.auth
          ) {
            console.error(
              "Subscription is missing one or more required properties.",
            );
            return; // Exit if the subscription is invalid
          }

          // THE FIX: Create a new, explicitly typed object that is guaranteed
          // to match the type expected by the `subscribeUser` action.
          const subscriptionToSend = {
            endpoint: subscriptionJSON.endpoint,
            keys: {
              p256dh: subscriptionJSON.keys.p256dh,
              auth: subscriptionJSON.keys.auth,
            },
          };

          // Now, TypeScript knows `subscriptionToSend` is perfectly shaped.
          await subscribeUser(subscriptionToSend);
        } catch (error) {
          console.error("Error subscribing to push notifications:", error);
        }
      }
    };

    createSubscription();
  }, [permission]);
  // --- END OF NEW CODE BLOCK ---

  useEffect(() => {
    if (permission === "default") {
      const dontAsk = localStorage.getItem(DONT_ASK_AGAIN_KEY);
      if (dontAsk === "true") {
        setIsPromptVisible(false);
        return;
      }

      const dismissedTimestamp = localStorage.getItem(PROMPT_DISMISSED_KEY);
      if (dismissedTimestamp) {
        if (
          Date.now() - parseInt(dismissedTimestamp, 10) <
          PROMPT_DISMISSED_TIMEOUT
        ) {
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
    // This now just updates the state. The new useEffect will handle the subscription.
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
        new Notification(title, {
          icon: "/icons/favicon.ico",
          ...options,
        });
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
