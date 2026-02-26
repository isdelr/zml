"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { getAuthUserId } from "./authCore";
import { internal } from "./_generated/api";
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
    return false;
  }

  if (
    !options?.force &&
    isAvatarObjectKey(user.image) &&
    user.imageCachedFromUrl === user.providerImageUrl
  ) {
    return false;
  }

  const response = await fetch(user.providerImageUrl, {
    headers: {
      Accept: "image/webp,image/*;q=0.8,*/*;q=0.5",
    },
  });
  if (!response.ok) {
    return false;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return false;
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_AVATAR_BYTES) {
    return false;
  }

  const webpBytes = await transcodeAvatarToWebp(bytes);
  if (!webpBytes) {
    return false;
  }

  const avatarKey = buildAvatarObjectKey(userId.toString());
  await storage.putObject(avatarKey, webpBytes, {
    contentType: "image/webp",
    contentLength: webpBytes.byteLength,
  });

  await ctx.runMutation(internal.users.setCachedAvatar, {
    userId,
    avatarKey,
    sourceUrl: user.providerImageUrl,
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
