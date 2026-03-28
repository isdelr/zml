import { getAuthUserId } from "./authCore";
import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { makeFunctionReference } from "convex/server";
import { internal } from "./_generated/api";
import { B2Storage } from "./b2Storage";
import { Doc, Id } from "./_generated/dataModel";

const storage = new B2Storage();
const STORAGE_UPLOAD_CLEANUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const STORAGE_UPLOAD_CLEANUP_BATCH_SIZE = 100;
const listStaleStorageUploadsRef = makeFunctionReference<
  "query",
  { staleBefore: number; limit: number }
>("files:listStaleStorageUploads");

const storageUploadKindValidator = v.union(
  v.literal("league_image"),
  v.literal("submission_file"),
);
const storageUploadClaimTypeValidator = v.union(
  v.literal("round_image"),
  v.literal("submission_album_art"),
  v.literal("submission_audio_original"),
);

async function ensureAuthenticated(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("You must be logged in to upload files.");
  }
  return userId;
}

function buildReservedUploadKey(kind: "league_image" | "submission_file") {
  const suffix = crypto.randomUUID();
  if (kind === "league_image") {
    return `rounds/images/${suffix}`;
  }
  return `uploads/submissions/${suffix}`;
}

async function reserveUpload(
  ctx: Pick<MutationCtx, "db">,
  input: {
    key: string;
    ownerUserId: Id<"users">;
    kind: "league_image" | "submission_file";
  },
) {
  const existing = await ctx.db
    .query("storageUploads")
    .withIndex("by_key", (q) => q.eq("key", input.key))
    .unique();

  if (existing) {
    await ctx.db.patch("storageUploads", existing._id, {
      ownerUserId: input.ownerUserId,
      kind: input.kind,
      status: "reserved",
      claimType: undefined,
      claimId: undefined,
      uploadedAt: undefined,
      claimedAt: undefined,
      deletedAt: undefined,
      lastCheckedAt: undefined,
    });
    return;
  }

  await ctx.db.insert("storageUploads", {
    key: input.key,
    ownerUserId: input.ownerUserId,
    kind: input.kind,
    status: "reserved",
    createdAt: Date.now(),
  });
}

export const generateLeagueImageUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    const userId = await ensureAuthenticated(ctx);
    const key = buildReservedUploadKey("league_image");
    await ctx.runMutation(internal.files.reserveStorageUpload, {
      key,
      ownerUserId: userId,
      kind: "league_image",
    });
    return storage.generateUploadUrl(key);
  },
});

export const syncLeagueImageMetadata = action({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await ensureAuthenticated(ctx);
    await ctx.runMutation(internal.files.markStorageUploadUploaded, {
      key: args.key,
      ownerUserId: userId,
    });
  },
});

export const generateSubmissionFileUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    const userId = await ensureAuthenticated(ctx);
    const key = buildReservedUploadKey("submission_file");
    await ctx.runMutation(internal.files.reserveStorageUpload, {
      key,
      ownerUserId: userId,
      kind: "submission_file",
    });
    return storage.generateUploadUrl(key);
  },
});

export const syncSubmissionFileMetadata = action({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await ensureAuthenticated(ctx);
    await ctx.runMutation(internal.files.markStorageUploadUploaded, {
      key: args.key,
      ownerUserId: userId,
    });
  },
});

export const reserveStorageUpload = internalMutation({
  args: {
    key: v.string(),
    ownerUserId: v.id("users"),
    kind: storageUploadKindValidator,
  },
  handler: async (ctx, args) => {
    await reserveUpload(ctx, args);
  },
});

export const markStorageUploadUploaded = internalMutation({
  args: {
    key: v.string(),
    ownerUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const upload = await ctx.db
      .query("storageUploads")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (!upload || upload.ownerUserId !== args.ownerUserId) {
      throw new Error("Storage upload reservation not found.");
    }

    if (upload.status === "claimed" || upload.status === "deleted") {
      return;
    }

    await ctx.db.patch("storageUploads", upload._id, {
      status: "uploaded",
      uploadedAt: Date.now(),
      lastCheckedAt: Date.now(),
    });
  },
});

export const claimStorageUpload = internalMutation({
  args: {
    key: v.string(),
    ownerUserId: v.id("users"),
    kind: storageUploadKindValidator,
    claimType: storageUploadClaimTypeValidator,
    claimId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const upload = await ctx.db
      .query("storageUploads")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (!upload) {
      throw new Error("Uploaded file reservation not found.");
    }
    if (upload.ownerUserId !== args.ownerUserId) {
      throw new Error("You do not own this uploaded file.");
    }
    if (upload.kind !== args.kind) {
      throw new Error("Uploaded file type does not match expected usage.");
    }
    if (upload.status !== "uploaded" && upload.status !== "claimed") {
      throw new Error("Uploaded file is not ready to be claimed.");
    }
    if (
      upload.status === "claimed" &&
      upload.claimType === args.claimType &&
      upload.claimId === args.claimId
    ) {
      return true;
    }
    if (upload.status === "claimed") {
      throw new Error("Uploaded file has already been claimed.");
    }

    await ctx.db.patch("storageUploads", upload._id, {
      status: "claimed",
      claimType: args.claimType,
      claimId: args.claimId,
      claimedAt: Date.now(),
      lastCheckedAt: Date.now(),
    });
    return true;
  },
});

export const markStorageUploadsDeleted = internalMutation({
  args: {
    keys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const uniqueKeys = [...new Set(args.keys)].filter((key) => key.length > 0);
    if (uniqueKeys.length === 0) {
      return;
    }

    const uploads = await Promise.all(
      uniqueKeys.map((key) =>
        ctx.db
          .query("storageUploads")
          .withIndex("by_key", (q) => q.eq("key", key))
          .unique(),
      ),
    );

    await Promise.all(
      uploads
        .filter((upload): upload is Doc<"storageUploads"> => upload !== null)
        .map((upload) =>
          ctx.db.patch("storageUploads", upload._id, {
            status: "deleted",
            deletedAt: Date.now(),
            lastCheckedAt: Date.now(),
          }),
        ),
    );
  },
});

export const listStaleStorageUploads = internalQuery({
  args: {
    staleBefore: v.number(),
    limit: v.number(),
  },
  returns: v.array(
    v.object({
      key: v.string(),
      status: v.union(v.literal("reserved"), v.literal("uploaded")),
    }),
  ),
  handler: async (ctx, args) => {
    const [reserved, uploaded] = await Promise.all([
      ctx.db
        .query("storageUploads")
        .withIndex("by_status_and_created_at", (q) =>
          q.eq("status", "reserved").lte("createdAt", args.staleBefore),
        )
        .take(args.limit),
      ctx.db
        .query("storageUploads")
        .withIndex("by_status_and_created_at", (q) =>
          q.eq("status", "uploaded").lte("createdAt", args.staleBefore),
        )
        .take(args.limit),
    ]);

    return [...reserved, ...uploaded]
      .slice(0, args.limit)
      .map((upload) => ({
        key: upload.key,
        status: upload.status as "reserved" | "uploaded",
      }));
  },
});

export const cleanupStaleStorageUploads = internalAction({
  args: {
    maxAgeMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    deletedObjects: v.number(),
    markedRecords: v.number(),
  }),
  handler: async (ctx, args) => {
    const staleBefore =
      Date.now() - (args.maxAgeMs ?? STORAGE_UPLOAD_CLEANUP_MAX_AGE_MS);
    const limit = Math.max(
      1,
      Math.min(args.limit ?? STORAGE_UPLOAD_CLEANUP_BATCH_SIZE, 500),
    );
    const staleUploads = await ctx.runQuery(listStaleStorageUploadsRef, {
      staleBefore,
      limit,
    });

    let deletedObjects = 0;
    for (const upload of staleUploads) {
      if (upload.status === "uploaded") {
        try {
          await storage.deleteObject(upload.key);
          deletedObjects += 1;
        } catch (error) {
          console.error(`Failed to delete stale uploaded object "${upload.key}"`, error);
          continue;
        }
      }
    }

    await ctx.runMutation(internal.files.markStorageUploadsDeleted, {
      keys: staleUploads.map((upload: { key: string }) => upload.key),
    });

    return {
      deletedObjects,
      markedRecords: staleUploads.length,
    };
  },
});
