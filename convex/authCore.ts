import { createClient } from "@convex-dev/better-auth";
import type { ComponentApi } from "@convex-dev/better-auth/_generated/component.js";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import type { DataModel } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { isAvatarObjectKey } from "./userAvatar";

export type AuthUserDoc = {
  _id: string;
  userId?: string | null;
  name: string;
  email: string;
  image?: string | null;
  emailVerified: boolean;
  isAnonymous?: boolean | null;
};

const betterAuthComponent = (
  components as unknown as {
    betterAuth: ComponentApi<"betterAuth">;
  }
).betterAuth;

type TriggerArgs = { [key: string]: unknown };
const onCreateRef = makeFunctionReference<"mutation", TriggerArgs>(
  "auth:onCreate",
) as unknown as FunctionReference<"mutation", "internal", TriggerArgs>;
const onUpdateRef = makeFunctionReference<"mutation", TriggerArgs>(
  "auth:onUpdate",
) as unknown as FunctionReference<"mutation", "internal", TriggerArgs>;
const onDeleteRef = makeFunctionReference<"mutation", TriggerArgs>(
  "auth:onDelete",
) as unknown as FunctionReference<"mutation", "internal", TriggerArgs>;

const upsertAppUser = async (
  ctx: MutationCtx,
  authUser: AuthUserDoc,
): Promise<Id<"users">> => {
  const providerImageUrl = normalizeProviderImageUrl(authUser.image);
  const patchData: {
    name: string;
    email: string;
    providerImageUrl?: string;
    emailVerificationTime?: number;
  } = {
    name: authUser.name,
    email: authUser.email,
    ...(authUser.emailVerified ? { emailVerificationTime: Date.now() } : {}),
  };
  if (providerImageUrl) {
    patchData.providerImageUrl = providerImageUrl;
  }

  if (authUser.userId) {
    const mappedId = authUser.userId as Id<"users">;
    const existingMappedUser = await ctx.db.get("users", mappedId);
    if (existingMappedUser) {
      const providerImageChanged =
        !!providerImageUrl &&
        providerImageUrl !== existingMappedUser.providerImageUrl;
      const existingAvatarKey = isAvatarObjectKey(existingMappedUser.image)
        ? existingMappedUser.image
        : undefined;

      await ctx.db.patch(existingMappedUser._id, {
        ...patchData,
        // Keep serving the cached avatar until the next login-triggered sync refreshes it.
        image: existingAvatarKey,
        ...(providerImageChanged
          ? { imageCachedFromUrl: undefined, imageCachedAt: undefined }
          : {}),
      });
      return existingMappedUser._id;
    }
  }

  const existingByEmail = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", authUser.email))
    .first();

  if (existingByEmail) {
    const providerImageChanged =
      !!providerImageUrl &&
      providerImageUrl !== existingByEmail.providerImageUrl;
    const existingAvatarKey = isAvatarObjectKey(existingByEmail.image)
      ? existingByEmail.image
      : undefined;

    await ctx.db.patch(existingByEmail._id, {
      ...patchData,
      // Keep serving the cached avatar until the next login-triggered sync refreshes it.
      image: existingAvatarKey,
      ...(providerImageChanged
        ? { imageCachedFromUrl: undefined, imageCachedAt: undefined }
        : {}),
    });
    return existingByEmail._id;
  }

  return await ctx.db.insert("users", {
    ...patchData,
    isAnonymous: authUser.isAnonymous ?? undefined,
  });
};

function normalizeProviderImageUrl(image: string | null | undefined) {
  if (!image) {
    return undefined;
  }

  try {
    const url = new URL(image);
    const isDiscordHost =
      url.hostname === "cdn.discordapp.com" ||
      url.hostname === "media.discordapp.net";

    if (isDiscordHost) {
      // Normalize Discord avatar URLs to a stable form.
      // `media.discordapp.net` transform params can intermittently 400.
      url.hostname = "cdn.discordapp.com";
      url.searchParams.delete("format");
      url.searchParams.delete("quality");

      // Keep embed avatar URLs untouched, but normalize regular avatar size.
      const isEmbedAvatar = /^\/embed\/avatars\/\d+\.png$/u.test(url.pathname);
      if (isEmbedAvatar) {
        url.searchParams.delete("size");
      } else {
        url.searchParams.set("size", "256");
      }
    }

    return url.toString();
  } catch {
    return image;
  }
}

async function scheduleAvatarRefreshOnLogin(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  await ctx.scheduler.runAfter(0, internal.users.syncCachedAvatarForUser, {
    userId,
    force: true,
  });
}

export const authComponent = createClient<DataModel>(betterAuthComponent, {
  authFunctions: {
    onCreate: onCreateRef,
    onUpdate: onUpdateRef,
    onDelete: onDeleteRef,
  },
  triggers: {
    user: {
      onCreate: async (ctx, user) => {
        const appUserId = await upsertAppUser(ctx, user as AuthUserDoc);
        await authComponent.setUserId(ctx, user._id, appUserId);
        await scheduleAvatarRefreshOnLogin(ctx, appUserId);
      },
      onUpdate: async (ctx, newUser) => {
        await upsertAppUser(ctx, newUser as AuthUserDoc);
      },
      onDelete: async () => {
        // Keep domain data intact if Better Auth user records are deleted.
      },
    },
    session: {
      onCreate: async (ctx, session) => {
        const authUser = await authComponent.getAnyUserById(ctx, session.userId);
        if (!authUser) {
          return;
        }

        const appUserId = await upsertAppUser(ctx, authUser as AuthUserDoc);
        await authComponent.setUserId(ctx, authUser._id, appUserId);
        await scheduleAvatarRefreshOnLogin(ctx, appUserId);
      },
    },
  },
});

export const getAuthUserId = async (
  ctx: GenericCtx<DataModel>,
): Promise<Id<"users"> | null> => {
  const identity = await ctx.auth.getUserIdentity();
  const claimedUserId = identity?.userId;
  if (typeof claimedUserId === "string" && claimedUserId.length > 0) {
    return claimedUserId as Id<"users">;
  }
  return null;
};
