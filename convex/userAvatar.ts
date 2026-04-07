import type { Doc } from "./_generated/dataModel";
import { B2Storage } from "./b2Storage";
import { buildUserAvatarMediaUrl } from "../lib/media/delivery";

export const AVATAR_KEY_PREFIX = "avatars/";
export type AvatarObjectKey = `${typeof AVATAR_KEY_PREFIX}${string}`;

type UserAvatarFields = Pick<
  Doc<"users">,
  "image" | "providerImageUrl" | "imageCachedAt"
>;

export function isAvatarObjectKey(
  value: string | null | undefined,
): value is AvatarObjectKey {
  return Boolean(value && value.startsWith(AVATAR_KEY_PREFIX));
}

export function buildAvatarObjectKey(userId: string): AvatarObjectKey {
  return `${AVATAR_KEY_PREFIX}${userId}.webp`;
}

export async function resolveUserAvatarUrl(
  _storage: B2Storage,
  user: UserAvatarFields | null | undefined,
): Promise<string | null> {
  if (!user) {
    return null;
  }

  const imageValue = user.image;
  if (isAvatarObjectKey(imageValue)) {
    try {
      return await buildUserAvatarMediaUrl({
        userId: imageValue.slice(AVATAR_KEY_PREFIX.length).replace(/\.webp$/u, ""),
        storageKey: imageValue,
        version: user.imageCachedAt,
      });
    } catch (error) {
      console.error(`Failed to resolve avatar key "${imageValue}"`, error);
      return null;
    }
  }

  // Only serve avatars that were cached to our own storage.
  // Never fall back to provider-hosted URLs.
  return null;
}
