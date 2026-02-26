import type { GenericCtx } from "@convex-dev/better-auth/utils";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import type { OAuth2Tokens } from "better-auth";
import type { HttpRouter } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import { authComponent, getAuthUserId } from "./authCore";

type DiscordProfile = {
  id: string;
  username: string;
  global_name: string | null;
  email: string | null;
  verified: boolean;
  avatar: string | null;
  discriminator: string;
};

type DiscordGuild = {
  id: string;
};

type DiscordUserInfoResult = {
  user: {
    id: string;
    name: string;
    email: string;
    image: string;
    emailVerified: boolean;
  };
  data: DiscordProfile;
};

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

const resolveDiscordAvatarUrl = (profile: DiscordProfile) => {
  if (profile.avatar === null) {
    const defaultAvatarNumber =
      profile.discriminator === "0"
        ? Number(BigInt(profile.id) >> BigInt(22)) % 6
        : Number.parseInt(profile.discriminator, 10) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
  }
  const format = profile.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
};

const assertDiscordGuildMembership = async (accessToken: string) => {
  const requiredServerId = process.env.DISCORD_SERVER_ID;
  if (!requiredServerId) {
    throw new Error("DISCORD_SERVER_ID is required.");
  }

  const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!guildsResponse.ok) {
    throw new Error(
      `Failed to fetch Discord guild membership (${guildsResponse.status}).`,
    );
  }

  const guilds = (await guildsResponse.json()) as DiscordGuild[];
  const isMember = guilds.some((guild) => guild.id === requiredServerId);
  if (!isMember) {
    throw new Error(
      "You must be a member of the required Discord server to sign in.",
    );
  }
};

const getDiscordUserInfo = async (token: OAuth2Tokens) => {
  try {
    if (!token.accessToken) {
      throw new Error("Discord OAuth response did not include an access token.");
    }

    await assertDiscordGuildMembership(token.accessToken);

    const profileResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    if (!profileResponse.ok) {
      throw new Error(`Failed to fetch Discord profile (${profileResponse.status}).`);
    }

    const profile = (await profileResponse.json()) as DiscordProfile;
    if (!profile.email) {
      throw new Error("Discord account must have a verified email to sign in.");
    }

    return {
      user: {
        id: profile.id,
        name: profile.global_name ?? profile.username,
        email: profile.email,
        image: resolveDiscordAvatarUrl(profile),
        emailVerified: Boolean(profile.verified),
      },
      data: profile,
    } satisfies DiscordUserInfoResult;
  } catch (error) {
    console.error("[Auth][Discord] Failed to resolve user info during OAuth callback.", error);
    // Returning null lets Better Auth redirect with an OAuth error instead of returning HTTP 500.
    return null;
  }
};

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
