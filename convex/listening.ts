import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc } from "./_generated/dataModel";

// The duration in milliseconds to consider a user "active"
const LISTENING_TIMEOUT_MS = 60 * 1000; // 1 minute

/**
 * Updates or removes a user's listening activity record.
 * Call with a submissionId to mark the user as listening to that track.
 * Call with no submissionId to mark the user as no longer listening.
 */
export const updateListeningState = mutation({
  args: {
    submissionId: v.optional(v.id("submissions")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return; // Not logged in, do nothing.
    }

    const existingActivity = await ctx.db
      .query("listeningActivity")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (args.submissionId) {
      // User is actively listening to a song.
      if (existingActivity) {
        // If the user is listening to the same song, just update the timestamp.
        // Otherwise, update the song and timestamp.
        await ctx.db.patch(existingActivity._id, {
          submissionId: args.submissionId,
          lastSeen: Date.now(),
        });
      } else {
        // No previous activity for this user, so create a new record.
        await ctx.db.insert("listeningActivity", {
          userId,
          submissionId: args.submissionId,
          lastSeen: Date.now(),
        });
      }
    } else {
      // User has stopped listening. Remove their activity record if it exists.
      if (existingActivity) {
        await ctx.db.delete(existingActivity._id);
      }
    }
  },
});

/**
 * Fetches all users who have been actively listening to a specific submission
 * within the timeout period.
 */
export const getListenersForSubmission = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - LISTENING_TIMEOUT_MS;
    
    // Query for recent activity on the specified submission.
    const listeners = await ctx.db
      .query("listeningActivity")
      .withIndex("by_submission_lastSeen", (q) =>
        q.eq("submissionId", args.submissionId).gt("lastSeen", cutoff)
      )
      .collect();

    // Fetch the full user document for each listener to get their details.
    const users = await Promise.all(
      listeners.map(async (listener) => {
        return await ctx.db.get(listener.userId);
      })
    );

    // Filter out any null users and return the data formatted for the AvatarStack component.
    return users
      .filter((user): user is Doc<"users"> => user !== null)
      .map((user) => ({
        name: user.name,
        image: user.image,
      }));
  },
});