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

export const authNavigation = {
  assign(url: string) {
    window.location.assign(url);
  },
};

let activeDiscordSignInPromise: Promise<void> | null = null;

export const normalizeCallbackPath = (callbackURL: string) => {
  if (!callbackURL.startsWith("/") || callbackURL.startsWith("//")) {
    return "/explore";
  }
  return callbackURL;
};

export const extractAuthRedirectUrl = (result: unknown): string | null => {
  if (typeof result === "string" && result.length > 0) {
    return result;
  }

  if (typeof result !== "object" || result === null) {
    return null;
  }

  if ("url" in result && typeof result.url === "string" && result.url.length > 0) {
    return result.url;
  }

  if (
    "data" in result &&
    typeof result.data === "object" &&
    result.data !== null &&
    "url" in result.data &&
    typeof result.data.url === "string" &&
    result.data.url.length > 0
  ) {
    return result.data.url;
  }

  return null;
};

export const signInWithDiscord = async (callbackURL = "/explore") => {
  if (activeDiscordSignInPromise) {
    return activeDiscordSignInPromise;
  }

  const safeCallbackURL = normalizeCallbackPath(callbackURL);
  const errorParams = new URLSearchParams({
    redirect_url: safeCallbackURL,
  });

  activeDiscordSignInPromise = (async () => {
    const result = await authClient.signIn.social({
      provider: "discord",
      callbackURL: safeCallbackURL,
      errorCallbackURL: `/signin?${errorParams.toString()}`,
      disableRedirect: true,
    });

    const redirectUrl = extractAuthRedirectUrl(result);
    if (!redirectUrl) {
      throw new Error("Discord sign-in could not start. Please try again.");
    }

    if (typeof window !== "undefined") {
      authNavigation.assign(redirectUrl);
    }
  })().finally(() => {
    activeDiscordSignInPromise = null;
  });

  return activeDiscordSignInPromise;
};

export const signOutFromApp = async () => {
  await authClient.signOut();
  if (typeof window !== "undefined") {
    window.location.assign("/signin");
  }
};
