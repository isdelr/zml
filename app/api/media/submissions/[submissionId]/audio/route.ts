import { NextRequest } from "next/server";
import { serveMediaStorageAsset } from "@/lib/media/serve-submission-media";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await context.params;
  return serveMediaStorageAsset(request, {
    tokenSubjectId: submissionId,
    resourceId: `submission-${submissionId}`,
    assetKind: "audio",
  });
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await context.params;
  return serveMediaStorageAsset(request, {
    tokenSubjectId: submissionId,
    resourceId: `submission-${submissionId}`,
    assetKind: "audio",
  });
}
