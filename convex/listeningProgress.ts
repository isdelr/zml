import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

export const updateListeningProgress = mutation({
  args: {
    submissionId: v.id("submissions"),
    listenedTime: v.number(), // Additional time listened in seconds
    songDuration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required.");
    }

    // Get submission to determine league and round
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Submission not found.");
    }

    // Get league to check listening requirements
    const league = await ctx.db.get(submission.leagueId);
    if (!league) {
      throw new Error("League not found.");
    }

    // Check if user is a member of the league
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_league_and_user", (q) =>
        q.eq("leagueId", submission.leagueId).eq("userId", userId)
      )
      .first();

    if (!membership) {
      throw new Error("You are not a member of this league.");
    }

    // Find existing progress record
    const existingProgress = await ctx.db
      .query("listeningProgress")
      .withIndex("by_user_and_submission", (q) =>
        q.eq("userId", userId).eq("submissionId", args.submissionId)
      )
      .first();

    const currentTime = Date.now();
    let totalListenedTime: number;
    let songDuration = args.songDuration || submission.duration || 0;

    if (existingProgress) {
      totalListenedTime = existingProgress.totalListenedTime + args.listenedTime;
      if (args.songDuration && !existingProgress.songDuration) {
        songDuration = args.songDuration;
      } else if (existingProgress.songDuration) {
        songDuration = existingProgress.songDuration;
      }
    } else {
      totalListenedTime = args.listenedTime;
    }

    // Calculate if listening requirement is met
    let meetsRequirement = false;
    if (league.listeningRequirementPercentage && songDuration > 0) {
      const requiredTime = (songDuration * league.listeningRequirementPercentage) / 100;
      const maxTimeSeconds = (league.maxListeningTimeMinutes || Infinity) * 60;
      const actualRequiredTime = Math.min(requiredTime, maxTimeSeconds);
      meetsRequirement = totalListenedTime >= actualRequiredTime;
    } else {
      // If no requirements set, always meets requirement
      meetsRequirement = true;
    }

    if (existingProgress) {
      await ctx.db.patch(existingProgress._id, {
        totalListenedTime,
        songDuration,
        meetsRequirement,
        lastUpdated: currentTime,
      });
    } else {
      await ctx.db.insert("listeningProgress", {
        userId,
        submissionId: args.submissionId,
        leagueId: submission.leagueId,
        roundId: submission.roundId,
        totalListenedTime,
        songDuration,
        meetsRequirement,
        lastUpdated: currentTime,
      });
    }

    return { meetsRequirement, totalListenedTime, requiredTime: songDuration > 0 ? Math.min((songDuration * (league.listeningRequirementPercentage || 0)) / 100, (league.maxListeningTimeMinutes || Infinity) * 60) : 0 };
  },
});

export const getListeningProgress = query({
  args: {
    submissionId: v.id("submissions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const progress = await ctx.db
      .query("listeningProgress")
      .withIndex("by_user_and_submission", (q) =>
        q.eq("userId", userId).eq("submissionId", args.submissionId)
      )
      .first();

    if (!progress) {
      return null;
    }

    // Get league info to calculate requirements
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return null;

    const league = await ctx.db.get(submission.leagueId);
    if (!league) return null;

    let requiredTime = 0;
    if (league.listeningRequirementPercentage && progress.songDuration && progress.songDuration > 0) {
      const percentageTime = (progress.songDuration * league.listeningRequirementPercentage) / 100;
      const maxTimeSeconds = (league.maxListeningTimeMinutes || Infinity) * 60;
      requiredTime = Math.min(percentageTime, maxTimeSeconds);
    }

    return {
      totalListenedTime: progress.totalListenedTime,
      requiredTime,
      meetsRequirement: progress.meetsRequirement,
      songDuration: progress.songDuration,
      progressPercentage: requiredTime > 0 ? Math.min((progress.totalListenedTime / requiredTime) * 100, 100) : 100,
    };
  },
});

export const getUserListeningProgressForRound = query({
  args: {
    roundId: v.id("rounds"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const progressList = await ctx.db
      .query("listeningProgress")
      .withIndex("by_user_and_round", (q) =>
        q.eq("userId", userId).eq("roundId", args.roundId)
      )
      .collect();

    return progressList.map(progress => ({
      submissionId: progress.submissionId,
      meetsRequirement: progress.meetsRequirement,
      totalListenedTime: progress.totalListenedTime,
      progressPercentage: progress.songDuration && progress.songDuration > 0 ? 
        Math.min((progress.totalListenedTime / progress.songDuration) * 100, 100) : 100,
    }));
  },
});
