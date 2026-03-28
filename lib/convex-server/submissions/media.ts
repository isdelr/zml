import type { Doc } from "../../../convex/_generated/dataModel";
import type { B2Storage } from "../../../convex/b2Storage";
import {
  buildSubmissionMediaUrl,
  resolveMediaAccessScope,
} from "../../media/delivery";

export async function resolveSubmissionMediaUrls(
  _storage: Pick<B2Storage, "getUrl">,
  submission: Doc<"submissions">,
  access: {
    allowPublic: boolean;
    viewerUserId: string | null;
  },
): Promise<{ albumArtUrl: string | null; songFileUrl: string | null }> {
  if (submission.submissionType === "file") {
    if (!access.allowPublic && !access.viewerUserId) {
      return { albumArtUrl: null, songFileUrl: null };
    }

    const scope = resolveMediaAccessScope(
      access.allowPublic,
      access.viewerUserId,
    );
    if (!scope) {
      return { albumArtUrl: null, songFileUrl: null };
    }

    const [albumArtUrl, songFileUrl] = await Promise.all([
      submission.albumArtKey
        ? buildSubmissionMediaUrl({
            submissionId: submission._id,
            assetKind: "art",
            storageKey: submission.albumArtKey,
            scope,
          })
        : Promise.resolve(null),
      submission.songFileKey
        ? buildSubmissionMediaUrl({
            submissionId: submission._id,
            assetKind: "audio",
            storageKey: submission.songFileKey,
            scope,
          })
        : Promise.resolve(null),
    ]);
    return { albumArtUrl, songFileUrl };
  }

  return {
    albumArtUrl: submission.albumArtUrlValue ?? null,
    songFileUrl: submission.songLink ?? null,
  };
}
