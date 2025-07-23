 
'use client';

import { NotificationPermissionModal } from "@/components/NotificationPermissionModal";
import { GlobalNotificationHandler } from "@/components/GlobalNotificationHandler";
import { useConvexAuth } from "convex/react";
import { ReactNode } from "react";

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated } = useConvexAuth();

    return (
        <>
            {children}
            {isAuthenticated && (
                <>
                    <GlobalNotificationHandler />
                    <NotificationPermissionModal />
                </>
            )}
        </>
    );
}