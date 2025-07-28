"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useBrowserNotifier } from "@/hooks/useBrowserNotifier";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

/**
 * This component handles real-time, in-app notifications for the user.
 * It does not render any UI itself, but listens for new notifications
 * and displays them as toasts.
 */
export function GlobalNotificationHandler() {
  // We use a paginated query to fetch the most recent notifications.
  // Although we don't use the pagination feature (loadMore) here, this hook
  // is reactive and will update when new notifications are created.
  const { results: notifications } = usePaginatedQuery(
    api.notifications.getForUser,
    {},
    { initialNumItems: 5 }, // Fetch a small number of recent items.
  );

  const { permission } = useBrowserNotifier();
  const router = useRouter();

  // Use a ref to keep track of notifications shown in this session.
  // This prevents re-showing toasts on re-renders or if the user navigates
  // away and back, as this component persists in the layout.
  const shownNotifications = useRef(new Set<string>());

  useEffect(() => {
    // Only show notifications if:
    // 1. The browser tab is currently visible. The service worker handles background notifications.
    // 2. The user has granted notification permissions for the site.
    // 3. The notifications data has been loaded.
    if (
      document.visibilityState !== "visible" ||
      permission !== "granted" ||
      !notifications
    ) {
      return;
    }

    notifications.forEach((notification) => {
      // Check if the notification is unread and has not been shown in this session.
      if (
        !notification.read &&
        !shownNotifications.current.has(notification._id)
      ) {
        // Display the notification as an in-app toast.
        toast.info(notification.message, {
          description: notification.triggeringUserName
            ? `From: ${notification.triggeringUserName}`
            : "New update in your league.",
          action: {
            label: "View",
            onClick: () => router.push(notification.link),
          },
          // Use the notification ID as the toast ID to prevent duplicates if the
          // effect runs multiple times in quick succession.
          id: notification._id,
        });

        // Mark this notification as shown for the current session.
        shownNotifications.current.add(notification._id);
      }
    });
  }, [notifications, permission, router]);

  // This component does not render anything.
  return null;
}