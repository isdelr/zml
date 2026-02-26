"use client";

import { useConvexConnectionState } from "convex/react";

/**
 * Shows a disconnection banner when the Convex WebSocket is down.
 * Always renders children — Convex handles reconnection natively
 * and queries re-fire automatically.
 */
export function ConvexConnectionGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isWebSocketConnected, hasEverConnected, connectionRetries } =
    useConvexConnectionState();
  const showBanner =
    !isWebSocketConnected && (hasEverConnected || connectionRetries >= 3);

  return (
    <>
      {showBanner && (
        <div className="fixed top-0 inset-x-0 z-50 bg-destructive/90 text-destructive-foreground text-center text-xs py-1.5">
          Reconnecting to server...
        </div>
      )}
      {children}
    </>
  );
}
