"use client";

import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const getAuthBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_AUTH_BASE_URL) {
    return process.env.NEXT_PUBLIC_AUTH_BASE_URL;
  }
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "http://localhost:3000";
};

export const authClient = createAuthClient({
  baseURL: new URL("/api/auth", getAuthBaseUrl()).toString(),
  plugins: [convexClient()],
});

const normalizeCallbackPath = (callbackURL: string) => {
  if (!callbackURL.startsWith("/") || callbackURL.startsWith("//")) {
    return "/explore";
  }
  return callbackURL;
};

export const signInWithDiscord = async (callbackURL = "/explore") => {
  const safeCallbackURL = normalizeCallbackPath(callbackURL);
  const errorParams = new URLSearchParams({
    redirect_url: safeCallbackURL,
  });

  await authClient.signIn.social({
    provider: "discord",
    callbackURL: safeCallbackURL,
    errorCallbackURL: `/signin?${errorParams.toString()}`,
  });
};

export const signOutFromApp = async () => {
  await authClient.signOut();
};
