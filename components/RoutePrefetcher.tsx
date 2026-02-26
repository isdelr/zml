"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Add routes you want prefetched proactively.
// These are safe, static routes that are frequently visited.
const ROUTES_TO_PREFETCH = [
  "/explore",
  "/active-rounds",
  "/leagues/create",
  "/my-submissions",
  "/bookmarked",
  "/notifications",
];

export function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
// Best-effort prefetch. Ignore errors to avoid noisy logs in dev.
    ROUTES_TO_PREFETCH.forEach((href) => {
      try {
        router.prefetch(href);
      } catch {}
    });
  }, [router]);

  return null;
}