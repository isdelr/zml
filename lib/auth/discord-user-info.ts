import type { OAuth2Tokens } from "better-auth";
import { getAllowedDiscordServerIdsFromEnv } from "@/lib/discord/server-access";

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

export type DiscordUserInfoResult = {
  user: {
    id: string;
    name: string;
    email: string;
    image: string;
    emailVerified: boolean;
  };
  data: DiscordProfile;
};

function resolveDiscordAvatarUrl(profile: DiscordProfile) {
  if (profile.avatar === null) {
    const defaultAvatarNumber =
      profile.discriminator === "0"
        ? Number(BigInt(profile.id) >> BigInt(22)) % 6
        : Number.parseInt(profile.discriminator, 10) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
  }
  const format = profile.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
}

async function assertDiscordGuildMembership(accessToken: string) {
  const requiredServerIds = getAllowedDiscordServerIdsFromEnv();
  if (requiredServerIds.length === 0) {
    throw new Error("DISCORD_SERVER_ID is required and must include at least one server.");
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
  const isMember = guilds.some((guild) =>
    requiredServerIds.includes(guild.id),
  );
  if (!isMember) {
    throw new Error(
      "You must be a member of the required Discord server to sign in.",
    );
  }
}

export async function getDiscordUserInfo(token: OAuth2Tokens) {
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
    return null;
  }
}
