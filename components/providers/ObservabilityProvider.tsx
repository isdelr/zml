"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { usePathname, useSearchParams } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/lib/convex/api";

export function ObservabilityProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );

  useEffect(() => {
    const search = searchParams.toString();
    const route = search ? `${pathname}?${search}` : pathname;

    Sentry.setTag("route", pathname);
    Sentry.addBreadcrumb({
      category: "navigation",
      level: "info",
      message: route,
      type: "navigation",
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!currentUser) {
      Sentry.setUser(null);
      return;
    }

    Sentry.setUser({
      id: currentUser._id,
      username: currentUser.name,
      email:
        "email" in currentUser && typeof currentUser.email === "string"
          ? currentUser.email
          : undefined,
    });
  }, [currentUser]);

  return null;
}
