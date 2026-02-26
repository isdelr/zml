import type { Doc } from "./_generated/dataModel";
import { B2Storage } from "./b2Storage";

export const AVATAR_KEY_PREFIX = "avatars/";
const AVATAR_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 7;
export type AvatarObjectKey = `${typeof AVATAR_KEY_PREFIX}${string}`;

type UserAvatarFields = Pick<Doc<"users">, "image" | "providerImageUrl">;

export function isAvatarObjectKey(
  value: string | null | undefined,
): value is AvatarObjectKey {
  return Boolean(value && value.startsWith(AVATAR_KEY_PREFIX));
}

export function buildAvatarObjectKey(userId: string): AvatarObjectKey {
  return `${AVATAR_KEY_PREFIX}${userId}.webp`;
}

export async function resolveUserAvatarUrl(
  storage: B2Storage,
  user: UserAvatarFields | null | undefined,
): Promise<string | null> {
  if (!user) {
    return null;
  }

  const imageValue = user.image;
  if (isAvatarObjectKey(imageValue)) {
    try {
      return await storage.getUrl(imageValue, {
        expiresIn: AVATAR_URL_EXPIRY_SECONDS,
      });
    } catch (error) {
      console.error(`Failed to resolve avatar key "${imageValue}"`, error);
      return user.providerImageUrl ?? null;
    }
  }

  if (user.providerImageUrl) {
    return user.providerImageUrl;
  }

  if (imageValue && !imageValue.startsWith("data:image/")) {
    return imageValue;
  }
  return null;
}
