 
'use client';

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useBrowserNotifier } from "@/hooks/useBrowserNotifier";
import { useEffect, useRef } from "react";

export function GlobalNotificationHandler() {
    const notifications = useQuery(api.notifications.getForUser);
    const { showNotification, permission } = useBrowserNotifier();
    const shownNotifications = useRef(new Set<string>());

    useEffect(() => {
        if (permission === 'granted' && notifications) {
            notifications.forEach(notification => {
                 
                if (!notification.read && !shownNotifications.current.has(notification._id)) {
                    showNotification(notification.triggeringUserName ? `${notification.triggeringUserName}` : 'New Notification', {
                        body: notification.message,
                        tag: notification._id,  
                        data: {
                            url: notification.link
                        }
                    });
                     
                    shownNotifications.current.add(notification._id);
                }
            });
        }
    }, [notifications, permission, showNotification]);
    
    return null;  
}