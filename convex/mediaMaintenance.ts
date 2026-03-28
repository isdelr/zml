import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { isAvatarObjectKey } from "./userAvatar";

export const getStorageReferenceSnapshot = internalQuery({
  args: {},
  returns: v.object({
    referencedKeys: v.array(v.string()),
    trackedActiveKeys: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const [rounds, submissions, users, uploads] = await Promise.all([
      ctx.db.query("rounds").collect(),
      ctx.db.query("submissions").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("storageUploads").collect(),
    ]);

    const referencedKeys = new Set<string>();

    for (const round of rounds) {
      if (round.imageKey) {
        referencedKeys.add(round.imageKey);
      }
    }

    for (const submission of submissions) {
      if (submission.albumArtKey) {
        referencedKeys.add(submission.albumArtKey);
      }
      if (submission.songFileKey) {
        referencedKeys.add(submission.songFileKey);
      }
      if (submission.originalSongFileKey) {
        referencedKeys.add(submission.originalSongFileKey);
      }
      if (submission.songFileLegacyKey) {
        referencedKeys.add(submission.songFileLegacyKey);
      }
    }

    for (const user of users) {
      if (isAvatarObjectKey(user.image)) {
        referencedKeys.add(user.image);
      }
    }

    const trackedActiveKeys = new Set<string>();
    for (const upload of uploads) {
      if (
        upload.status === "reserved" ||
        upload.status === "uploaded" ||
        upload.status === "claimed"
      ) {
        trackedActiveKeys.add(upload.key);
      }
    }

    return {
      referencedKeys: [...referencedKeys],
      trackedActiveKeys: [...trackedActiveKeys],
    };
  },
});
