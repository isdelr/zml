import { NextRequest } from "next/server";
import { serveMediaStorageAsset } from "@/lib/media/serve-submission-media";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roundId: string }> },
) {
  const { roundId } = await context.params;
  return serveMediaStorageAsset(request, {
    tokenSubjectId: `round:${roundId}`,
    resourceId: `round-${roundId}`,
    assetKind: "art",
  });
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ roundId: string }> },
) {
  const { roundId } = await context.params;
  return serveMediaStorageAsset(request, {
    tokenSubjectId: `round:${roundId}`,
    resourceId: `round-${roundId}`,
    assetKind: "art",
  });
}
