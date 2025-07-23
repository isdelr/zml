import { getAuthUserId } from "@convex-dev/auth/server";
import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";

const r2 = new R2(components.r2);

 
export const {
  generateUploadUrl: generateLeagueImageUploadUrl,
  syncMetadata: syncLeagueImageMetadata,
} = r2.clientApi({
  checkUpload: async (ctx, bucket) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be logged in to upload an image.");
    }
  },
});

 
export const {
  generateUploadUrl: generateSubmissionFileUploadUrl,
  syncMetadata: syncSubmissionFileMetadata,
} = r2.clientApi({
  checkUpload: async (ctx, bucket) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be logged in to upload a file.");
    }
  },
});