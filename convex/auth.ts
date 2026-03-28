import type { GenericCtx } from "@convex-dev/better-auth/utils";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import type { HttpRouter } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import { authComponent, getAuthUserId } from "./authCore";
import { getDiscordUserInfo } from "../lib/auth/discord-user-info";

const getConvexSiteUrl = () => {
  const siteUrl = process.env.CONVEX_SITE_URL;
  if (!siteUrl) {
    throw new Error("CONVEX_SITE_URL is required for Better Auth.");
  }
  return siteUrl;
};

const getSiteUrl = () => {
  return process.env.SITE_URL ?? "http://localhost:3000";
};

const getAuthSecret = () => {
  return (
    process.env.BETTER_AUTH_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.INSTANCE_SECRET
  );
};

const getAuthRateLimitConfig = () => ({
  enabled: process.env.NODE_ENV === "production",
  window: 60,
  max: 20,
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: getSiteUrl(),
    basePath: "/api/auth",
    secret: getAuthSecret(),
    trustedOrigins: [getSiteUrl(), getConvexSiteUrl()],
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24 * 14,
    },
    account: {
      updateAccountOnSignIn: true,
    },
    rateLimit: getAuthRateLimitConfig(),
    database: authComponent.adapter(ctx),
    socialProviders: {
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID!,
        clientSecret: process.env.DISCORD_CLIENT_SECRET!,
        scope: ["identify", "email", "guilds"],
        getUserInfo: getDiscordUserInfo,
      },
    },
    plugins: [
      convex({
        authConfig,
        jwks: process.env.JWKS,
      }),
    ],
  });
};

export const registerAuthRoutes = (http: HttpRouter) => {
  authComponent.registerRoutes(http, createAuth);
};

export { getAuthUserId };
