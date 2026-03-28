import { NextRequest } from "next/server";
import { getPublicRoundImageKey } from "@/lib/media/public-media";
import { serveMediaStorageKey } from "@/lib/media/serve-submission-media";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roundId: string }> },
) {
  const { roundId } = await context.params;
  const storageKey = await getPublicRoundImageKey(roundId);
  if (!storageKey) {
    return new Response("Not found", { status: 404 });
  }

  return serveMediaStorageKey(request, {
    storageKey,
    resourceId: `round-${roundId}`,
    assetKind: "art",
  });
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ roundId: string }> },
) {
  const { roundId } = await context.params;
  const storageKey = await getPublicRoundImageKey(roundId);
  if (!storageKey) {
    return new Response(null, { status: 404 });
  }

  return serveMediaStorageKey(request, {
    storageKey,
    resourceId: `round-${roundId}`,
    assetKind: "art",
  });
}
