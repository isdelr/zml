import type { Doc } from "../../../convex/_generated/dataModel";
import type { B2Storage } from "../../../convex/b2Storage";

export async function resolveSubmissionMediaUrls(
  storage: Pick<B2Storage, "getUrl">,
  submission: Doc<"submissions">,
): Promise<{ albumArtUrl: string | null; songFileUrl: string | null }> {
  if (submission.submissionType === "file") {
    const [albumArtUrl, songFileUrl] = await Promise.all([
      submission.albumArtKey
        ? storage.getUrl(submission.albumArtKey)
        : Promise.resolve(null),
      submission.songFileKey
        ? storage.getUrl(submission.songFileKey)
        : Promise.resolve(null),
    ]);
    return { albumArtUrl, songFileUrl };
  }

  return {
    albumArtUrl: submission.albumArtUrlValue ?? null,
    songFileUrl: submission.songLink ?? null,
  };
}
