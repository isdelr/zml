import { NextRequest } from "next/server";
import { getPublicUserAvatarKey } from "@/lib/media/public-media";
import { serveMediaStorageKey } from "@/lib/media/serve-submission-media";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  const storageKey = await getPublicUserAvatarKey(userId);
  if (!storageKey) {
    return new Response("Not found", { status: 404 });
  }

  return serveMediaStorageKey(request, {
    storageKey,
    resourceId: `avatar-${userId}`,
    assetKind: "art",
  });
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  const storageKey = await getPublicUserAvatarKey(userId);
  if (!storageKey) {
    return new Response(null, { status: 404 });
  }

  return serveMediaStorageKey(request, {
    storageKey,
    resourceId: `avatar-${userId}`,
    assetKind: "art",
  });
}
