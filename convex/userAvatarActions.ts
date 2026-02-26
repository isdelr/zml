"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { getAuthUserId } from "./authCore";
import { components, internal } from "./_generated/api";
import { B2Storage } from "./b2Storage";
import type { Id } from "./_generated/dataModel";
import {
  buildAvatarObjectKey,
  isAvatarObjectKey,
} from "./userAvatar";

const storage = new B2Storage();
const MAX_AVATAR_BYTES = 5_000_000;
const AVATAR_OUTPUT_SIZE = 256;
const AVATAR_OUTPUT_QUALITY = 92;

function buildDiscordDefaultAvatarUrlFromAvatarUrl(
  providerImageUrl: string,
): string | null {
  try {
    const url = new URL(providerImageUrl);
    const isDiscordHost =
      url.hostname === "cdn.discordapp.com" ||
      url.hostname === "media.discordapp.net";
    if (!isDiscordHost) {
      return null;
    }

    const match = /^\/avatars\/(\d+)\/[^/]+$/u.exec(url.pathname);
    if (!match) {
      return null;
    }

    const userId = match[1];
    const fallbackIndex = Number((BigInt(userId) >> BigInt(22)) % BigInt(6));
    return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`;
  } catch {
    return null;
  }
}

type DiscordProfile = {
  id: string;
  avatar: string | null;
  discriminator: string;
};

function resolveDiscordAvatarUrlFromProfile(profile: DiscordProfile): string {
  if (profile.avatar === null) {
    const defaultAvatarNumber =
      profile.discriminator === "0"
        ? Number((BigInt(profile.id) >> BigInt(22)) % BigInt(6))
        : Number.parseInt(profile.discriminator, 10) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
  }
  const format = profile.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}?size=256`;
}

async function resolveFreshDiscordAvatarUrlFromOAuthAccount(
  ctx: Pick<ActionCtx, "runQuery">,
  userId: Id<"users">,
): Promise<string | null> {
  const authUser = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "userId", value: userId }],
  });

  if (!authUser?._id) {
    return null;
  }

  const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "account",
    where: [
      { field: "providerId", value: "discord" },
      { field: "userId", value: authUser._id },
    ],
  });

  const accessToken =
    typeof account?.accessToken === "string" && account.accessToken.length > 0
      ? account.accessToken
      : null;

  if (!accessToken) {
    return null;
  }

  const response = await fetch("https://discord.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    console.warn("[avatar-sync] failed to refresh discord profile using OAuth token", {
      userId,
      status: response.status,
    });
    return null;
  }

  const profile = (await response.json()) as DiscordProfile;
  if (!profile?.id) {
    return null;
  }

  return resolveDiscordAvatarUrlFromProfile(profile);
}

async function transcodeAvatarToWebp(
  inputBytes: ArrayBuffer,
): Promise<Uint8Array | null> {
  try {
    const { default: sharp } = await import("sharp");
    const output = await sharp(Buffer.from(inputBytes), {
      animated: false,
      failOn: "none",
      limitInputPixels: 4096 * 4096,
    })
      .rotate()
      .resize(AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: AVATAR_OUTPUT_QUALITY, effort: 4 })
      .toBuffer();

    if (output.byteLength === 0 || output.byteLength > MAX_AVATAR_BYTES) {
      return null;
    }

    return new Uint8Array(output);
  } catch (error) {
    console.error("Failed to transcode avatar to webp", error);
    return null;
  }
}

async function syncCachedAvatarForUserId(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation">,
  userId: Id<"users">,
  options?: { force?: boolean },
): Promise<boolean> {
  const user = await ctx.runQuery(internal.users.getAvatarSyncTarget, {
    userId,
  });

  if (!user?.providerImageUrl) {
    console.info("[avatar-sync] skipped: user has no providerImageUrl", { userId });
    return false;
  }

  if (
    !options?.force &&
    isAvatarObjectKey(user.image) &&
    user.imageCachedFromUrl === user.providerImageUrl
  ) {
    console.info("[avatar-sync] skipped: already cached for current provider URL", {
      userId,
    });
    return false;
  }

  let downloadUrl = user.providerImageUrl;
  let sourceUrlForMetadata = user.providerImageUrl;
  let response = await fetch(downloadUrl, {
    headers: {
      Accept: "image/webp,image/*;q=0.8,*/*;q=0.5",
    },
  });

  if (response.status === 404) {
    const refreshedProviderImageUrl = await resolveFreshDiscordAvatarUrlFromOAuthAccount(
      ctx,
      userId,
    );

    if (
      refreshedProviderImageUrl &&
      refreshedProviderImageUrl !== user.providerImageUrl
    ) {
      console.info(
        "[avatar-sync] provider avatar 404; retrying with fresh discord avatar URL from OAuth account",
        {
          userId,
          previousProviderImageUrl: user.providerImageUrl,
          refreshedProviderImageUrl,
        },
      );

      await ctx.runMutation(internal.users.setProviderImageUrlForAvatarSync, {
        userId,
        providerImageUrl: refreshedProviderImageUrl,
      });

      sourceUrlForMetadata = refreshedProviderImageUrl;
      downloadUrl = refreshedProviderImageUrl;
      response = await fetch(downloadUrl, {
        headers: {
          Accept: "image/webp,image/*;q=0.8,*/*;q=0.5",
        },
      });
    }
  }

  if (!response.ok && response.status === 404) {
    const discordFallbackUrl = buildDiscordDefaultAvatarUrlFromAvatarUrl(sourceUrlForMetadata);
    const isAlreadyDefaultAvatar = discordFallbackUrl === sourceUrlForMetadata;
    if (discordFallbackUrl && isAlreadyDefaultAvatar) {
      downloadUrl = discordFallbackUrl;
      response = await fetch(downloadUrl, {
        headers: {
          Accept: "image/webp,image/*;q=0.8,*/*;q=0.5",
        },
      });
    }
  }

  if (!response.ok) {
    console.warn("[avatar-sync] failed: download response was not ok", {
      userId,
      providerImageUrl: user.providerImageUrl,
      attemptedUrl: downloadUrl,
      status: response.status,
    });
    return false;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    console.warn("[avatar-sync] failed: downloaded content is not an image", {
      userId,
      providerImageUrl: user.providerImageUrl,
      attemptedUrl: downloadUrl,
      contentType,
    });
    return false;
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_AVATAR_BYTES) {
    console.warn("[avatar-sync] failed: invalid downloaded avatar size", {
      userId,
      providerImageUrl: user.providerImageUrl,
      attemptedUrl: downloadUrl,
      bytes: bytes.byteLength,
    });
    return false;
  }

  const webpBytes = await transcodeAvatarToWebp(bytes);
  if (!webpBytes) {
    console.warn("[avatar-sync] failed: avatar transcode returned null", {
      userId,
      providerImageUrl: user.providerImageUrl,
      attemptedUrl: downloadUrl,
    });
    return false;
  }

  const avatarKey = buildAvatarObjectKey(userId.toString());
  try {
    await storage.putObject(avatarKey, webpBytes, {
      contentType: "image/webp",
      contentLength: webpBytes.byteLength,
    });
  } catch (error) {
    console.error("[avatar-sync] failed: unable to upload avatar to storage", {
      userId,
      avatarKey,
      error,
    });
    return false;
  }

  try {
    await ctx.runMutation(internal.users.setCachedAvatar, {
      userId,
      avatarKey,
      sourceUrl: sourceUrlForMetadata,
    });
  } catch (error) {
    console.error("[avatar-sync] failed: unable to persist cached avatar metadata", {
      userId,
      avatarKey,
      providerImageUrl: sourceUrlForMetadata,
      error,
    });
    return false;
  }

  console.info("[avatar-sync] success", {
    userId,
    avatarKey,
    providerImageUrl: sourceUrlForMetadata,
    downloadedFrom: downloadUrl,
    webpBytes: webpBytes.byteLength,
  });

  return true;
}

export const syncCachedAvatar = action({
  args: {},
  returns: v.object({ updated: v.boolean() }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { updated: false };
    }

    const updated = await syncCachedAvatarForUserId(ctx, userId);
    return { updated };
  },
});

export const syncCachedAvatarForUser = internalAction({
  args: {
    userId: v.id("users"),
    force: v.optional(v.boolean()),
  },
  returns: v.object({ updated: v.boolean() }),
  handler: async (ctx, args) => {
    const updated = await syncCachedAvatarForUserId(ctx, args.userId, {
      force: args.force ?? false,
    });
    return { updated };
  },
});
