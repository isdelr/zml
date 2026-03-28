import { NextRequest } from "next/server";
import { getPublicSubmissionAlbumArtKey } from "@/lib/media/public-media";
import { serveMediaStorageKey } from "@/lib/media/serve-submission-media";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await context.params;
  const storageKey = await getPublicSubmissionAlbumArtKey(submissionId);
  if (!storageKey) {
    return new Response("Not found", { status: 404 });
  }

  return serveMediaStorageKey(request, {
    storageKey,
    resourceId: `submission-${submissionId}`,
    assetKind: "art",
  });
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await context.params;
  const storageKey = await getPublicSubmissionAlbumArtKey(submissionId);
  if (!storageKey) {
    return new Response(null, { status: 404 });
  }

  return serveMediaStorageKey(request, {
    storageKey,
    resourceId: `submission-${submissionId}`,
    assetKind: "art",
  });
}
