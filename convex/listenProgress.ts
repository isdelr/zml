import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
/**
 * Fetches the listening progress for the current user for all submissions in a given round.
 */
export const getForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
      .collect();

    if (submissions.length === 0) return [];

    const submissionIds = submissions.map((s) => s._id);

    // Fetch all progress documents for the user and the round's submissions in parallel.
    const progressDocs = await Promise.all(
      submissionIds.map((submissionId) =>
        ctx.db
          .query("listenProgress")
          .withIndex("by_user_and_submission", (q) =>
            q.eq("userId", userId).eq("submissionId", submissionId),
          )
          .first(),
      ),
    );

    // Filter out nulls for submissions the user hasn't started listening to yet.
    return progressDocs.filter((doc): doc is NonNullable<typeof doc> => doc !== null);
  },
});

/**
 * Updates a user's listening progress for a specific submission.
 * This is designed to be called periodically from the client.
 */
export const updateProgress = mutation({
  args: {
    submissionId: v.id("submissions"),
    progressSeconds: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const submission = await ctx.db.get(args.submissionId);
    if (!submission || submission.duration === undefined || submission.duration === null) return;

    const league = await ctx.db.get(submission.leagueId);
    if (
      !league ||
      !league.enforceListenPercentage ||
      league.listenPercentage === undefined ||
      league.listenTimeLimitMinutes === undefined
    ) {
      // If the league doesn't enforce listening, no need to track.
      return;
    }

    const existingProgress = await ctx.db
      .query("listenProgress")
      .withIndex("by_user_and_submission", (q) =>
        q.eq("userId", userId).eq("submissionId", args.submissionId),
      )
      .first();

    // If the requirement has already been met, we don't need any more updates.
    if (existingProgress?.isCompleted) {
      return;
    }

    const requiredPercentage = league.listenPercentage / 100;
    const timeLimitSeconds = league.listenTimeLimitMinutes * 60;
    const requiredListenTime = Math.min(
      submission.duration * requiredPercentage,
      timeLimitSeconds,
    );

    const isCompleted = args.progressSeconds >= requiredListenTime;

    if (existingProgress) {
      // SECURITY: To prevent users from cheating by skipping ahead, we only accept updates
      // that are reasonably close to their last recorded progress. A 15-second buffer
      // allows for network latency and minor seeking without allowing huge jumps.
      if (args.progressSeconds > existingProgress.progressSeconds + 15) {
        return; // User likely skipped ahead; ignore this update.
      }
      
      await ctx.db.patch(existingProgress._id, {
        // Always store the highest progress reached to handle cases where the user seeks backward.
        progressSeconds: Math.max(args.progressSeconds, existingProgress.progressSeconds),
        isCompleted: existingProgress.isCompleted || isCompleted,
      });
    } else {
      // This is the first progress update for this song.
      await ctx.db.insert("listenProgress", {
        userId,
        submissionId: args.submissionId,
        progressSeconds: args.progressSeconds,
        isCompleted,
      });
    }
  },
});