"use client";

import { useEffect } from "react";
import {
  isConvexVersionMismatchError,
  recoverFromStaleClient,
} from "@/lib/stale-client-recovery";

export function ConvexFatalErrorRecovery() {
  useEffect(() => {
    const recover = (error: unknown) => {
      if (!isConvexVersionMismatchError(error)) {
        return;
      }

      void recoverFromStaleClient({
        key: "convex-version-mismatch",
        error,
      });
    };

    const onError = (event: ErrorEvent) => {
      recover(event.error ?? event.message);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      recover(event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
