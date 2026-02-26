import { getAuthUserId } from "./authCore";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { B2Storage } from "./b2Storage";

const storage = new B2Storage();

async function ensureAuthenticated(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("You must be logged in to upload files.");
  }
}

export const generateLeagueImageUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    await ensureAuthenticated(ctx);
    return storage.generateUploadUrl();
  },
});

export const syncLeagueImageMetadata = action({
  args: {
    key: v.string(),
  },
  handler: async (ctx) => {
    await ensureAuthenticated(ctx);
  },
});

export const generateSubmissionFileUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    await ensureAuthenticated(ctx);
    return storage.generateUploadUrl();
  },
});

export const syncSubmissionFileMetadata = action({
  args: {
    key: v.string(),
  },
  handler: async (ctx) => {
    await ensureAuthenticated(ctx);
  },
});
