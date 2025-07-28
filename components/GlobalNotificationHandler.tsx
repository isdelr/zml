'use client';

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useBrowserNotifier } from "@/hooks/useBrowserNotifier";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function GlobalNotificationHandler() {
    const notifications = useQuery(api.notifications.getForUser);
    const { permission } = useBrowserNotifier(); // Only need permission status
    const shownNotifications = useRef(new Set<string>());
    const router = useRouter();

    useEffect(() => {
        // Only show notifications if the app is the active tab and permission is granted.
        // The service worker will handle notifications when the app is in the background.
        if (document.visibilityState !== 'visible' || permission !== 'granted' || !notifications) {
            return;
        }

        notifications.forEach(notification => {
            // Check if notification is unread and has not been shown in this session.
            if (!notification.read && !shownNotifications.current.has(notification._id)) {
                
                // Use an in-app toast instead of a system notification.
                // This avoids conflicts with the service worker and is better UX.
                toast.info(notification.message, {
                    description: notification.triggeringUserName 
                        ? `From: ${notification.triggeringUserName}` 
                        : "New update in your league.",
                    action: {
                        label: "View",
                        onClick: () => router.push(notification.link),
                    },
                    // Use the notification ID as the toast ID to prevent duplicates
                    id: notification._id, 
                });

                // Mark this notification as shown in this session.
                shownNotifications.current.add(notification._id);
            }
        });

    }, [notifications, permission, router]);
    
    return null;  
}