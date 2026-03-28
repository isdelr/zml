import { NextRequest } from "next/server";
import { serveMediaStorageAsset } from "@/lib/media/serve-submission-media";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  return serveMediaStorageAsset(request, {
    tokenSubjectId: `avatar:${userId}`,
    resourceId: `avatar-${userId}`,
    assetKind: "art",
  });
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  return serveMediaStorageAsset(request, {
    tokenSubjectId: `avatar:${userId}`,
    resourceId: `avatar-${userId}`,
    assetKind: "art",
  });
}
