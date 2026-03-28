import { NextRequest } from "next/server";
import { serveSubmissionMediaAsset } from "@/lib/media/serve-submission-media";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await context.params;
  return serveSubmissionMediaAsset(request, {
    submissionId,
    assetKind: "audio",
  });
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await context.params;
  return serveSubmissionMediaAsset(request, {
    submissionId,
    assetKind: "audio",
  });
}
