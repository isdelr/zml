//auth.ts

import Discord, { DiscordProfile } from "@auth/core/providers/discord";
import { convexAuth } from "@convex-dev/auth/server";
import type { TokenSet } from "@auth/core/types";
import { AccessDenied } from "@auth/core/errors";

const CustomDiscord = Discord({
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  authorization: {
    params: {
      scope: "identify email guilds",
      prompt: "none",
    },
  },
  async profile(profile: DiscordProfile, tokens: TokenSet) {
    if (!tokens.access_token) {
      throw new Error("Access token not found in Discord OAuth response.");
    }

    const guildsResponse = await fetch(
      "https://discord.com/api/users/@me/guilds",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );
    if (!guildsResponse.ok) {
      throw new Error("Failed to fetch user's Discord guilds.");
    }
    const guilds: { id: string }[] = await guildsResponse.json();

    const requiredServerId = process.env.DISCORD_SERVER_ID;
    if (!requiredServerId) {
      throw new Error("Server configuration error.");
    }
    const isMember = guilds.some((guild) => guild.id === requiredServerId);
    if (!isMember) {
      throw new AccessDenied(
        "You must be a member of the required Discord server to sign in."
      );
    }

    if (profile.avatar === null) {
      const defaultAvatarNumber =
        profile.discriminator === "0"
          ? Number(BigInt(profile.id) >> BigInt(22)) % 6
          : parseInt(profile.discriminator) % 5;
      profile.image_url = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
    } else {
      const format = profile.avatar.startsWith("a_") ? "gif" : "png";
      profile.image_url = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
    }

    return {
      id: profile.id,
      name: profile.global_name ?? profile.username,
      email: profile.email,
      image: profile.image_url,
    };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [CustomDiscord],
  // Make sessions durable for PWAs: keep users signed in unless inactive for a long time
  session: {
    // Total session lifetime before requiring re-auth (e.g., 30 days)
    totalDurationMs: 1000 * 60 * 60 * 24 * 30,
    // How long a user can be inactive before session expires (e.g., 14 days)
    inactiveDurationMs: 1000 * 60 * 60 * 24 * 14,
  },
});