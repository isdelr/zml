// File: convex/listenProgress.ts

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc } from "./_generated/dataModel";

/**
 * Return all listen progress docs for the current user within a round.
 * Optimized to perform a single indexed scan for the user's progress and
 * then filter to the submissions in the round, instead of N lookups.
 */
export const getForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args): Promise<Doc<"listenProgress">[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Fetch submissions in this round (we only need their IDs)
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
      .collect();
    if (submissions.length === 0) return [];

    const submissionIdSet = new Set(submissions.map((s) => s._id.toString()));

    // Scan all of the user's listen progress (indexed by userId),
    // and filter down to just the submissions in this round.
    const allMyProgress = await ctx.db
      .query("listenProgress")
      .withIndex("by_user_and_submission", (q) => q.eq("userId", userId))
      .collect();

    return allMyProgress.filter((p) =>
      submissionIdSet.has(p.submissionId.toString()),
    );
  },
});

/**
 * Updates a user's listening progress for a specific submission.
 * - Robust input validation and clamping
 * - Server-side guards against tampering (disallow large jumps)
 * - Only updates when there's meaningful change
 * - Ignores non-file submissions and disabled listen rules
 */
export const updateProgress = mutation({
  args: {
    submissionId: v.id("submissions"),
    progressSeconds: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    // Validate inbound value early
    if (!Number.isFinite(args.progressSeconds)) return;

    const submission = await ctx.db.get(args.submissionId);
    if (
      !submission ||
      submission.duration === undefined ||
      submission.duration === null
    ) {
      return;
    }

    // Track progress for file-based and link submissions (youtube)
    if (!["file", "youtube"].includes(submission.submissionType)) {
      return;
    }

    const league = await ctx.db.get(submission.leagueId);
    if (!league || !league.enforceListenPercentage) {
      // If listening is not enforced, we don't need to track.
      return;
    }

    // Handle legacy or partially configured leagues gracefully.
    // Default to "percentage only" if time limit is missing.
    const listenPercentage =
      league.listenPercentage !== undefined ? league.listenPercentage : 100;
    const timeLimitSeconds =
      league.listenTimeLimitMinutes !== undefined
        ? Math.max(0, league.listenTimeLimitMinutes * 60)
        : Infinity;

    const requiredPercentage = Math.max(0, Math.min(100, listenPercentage)) / 100;
    const requiredListenTime = Math.min(
      submission.duration * requiredPercentage,
      timeLimitSeconds,
    );

    // Normalize and clamp reported progress to [0, duration] and to integer seconds
    const reported = Math.max(
      0,
      Math.min(submission.duration, Math.floor(args.progressSeconds)),
    );

    const existing = await ctx.db
      .query("listenProgress")
      .withIndex("by_user_and_submission", (q) =>
        q.eq("userId", userId).eq("submissionId", args.submissionId),
      )
      .first();

    // If we've already marked completion, do nothing.
    if (existing?.isCompleted) return;

    // Small optimization: if existing progress is already ahead of the report,
    // there's nothing to do (Math.max below would keep the old value anyway).
    if (existing && reported <= existing.progressSeconds) {
      // If not completed yet, check whether existing progress already meets requirement.
      if (existing.progressSeconds >= requiredListenTime) {
        await ctx.db.patch(existing._id, { isCompleted: true });
      }
      return;
    }

    // Anti-tampering: Disallow unnaturally large jumps forward between updates.
    // Use a bounded allowance that scales gently with track length.
    // - Minimum allowance: 15s (network hiccups, tab throttling)
    // - Maximum allowance: 60s (prevent huge leaps)
    // - Also consider up to 10% of track length for very short tracks.
    const allowedJumpSec = Math.min(
      60,
      Math.max(15, Math.floor(submission.duration * 0.1)),
    );

    if (existing) {
      const delta = reported - existing.progressSeconds;
      if (delta > allowedJumpSec) {
        // Likely a manual seek far ahead — ignore this update.
        return;
      }

      const newProgress = existing.progressSeconds + delta; // equals 'reported'
      const completed = newProgress >= requiredListenTime;

      // Only write if something actually changed.
      if (newProgress !== existing.progressSeconds || completed !== existing.isCompleted) {
        await ctx.db.patch(existing._id, {
          progressSeconds: newProgress,
          isCompleted: completed,
        });
      }
    } else {
      // First record: accept as-is (already clamped), but still apply anti-tamper
      // for extremely large initial reports (e.g., direct jump near the end).
      // For first update, allow up to allowedJumpSec; otherwise, start at reported if small.
      const initialProgress =
        reported > allowedJumpSec ? 0 : reported;

      await ctx.db.insert("listenProgress", {
        userId,
        submissionId: args.submissionId,
        progressSeconds: initialProgress,
        isCompleted: initialProgress >= requiredListenTime,
      });
    }
  },
});