'use client';

import { NotificationPermissionModal } from "@/components/NotificationPermissionModal";
import { GlobalNotificationHandler } from "@/components/GlobalNotificationHandler";
import { useConvexAuth } from "convex/react";
import { ReactNode } from "react";
import { NonBlockingErrorBoundary } from "@/components/NonBlockingErrorBoundary";

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated } = useConvexAuth();

    return (
        <>
            {children}
            {isAuthenticated && (
                <>
                    <NonBlockingErrorBoundary boundaryName="GlobalNotificationHandler">
                        <GlobalNotificationHandler />
                    </NonBlockingErrorBoundary>
                    <NotificationPermissionModal />
                </>
            )}
        </>
    );
}
