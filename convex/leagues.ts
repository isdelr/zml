import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc } from "./_generated/dataModel";

// Helper to convert days to milliseconds
const daysToMs = (days: number) => days * 24 * 60 * 60 * 1000;


export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    isPublic: v.boolean(),
    submissionDeadline: v.number(),
    votingDeadline: v.number(),
    maxPositiveVotes: v.number(),
    maxNegativeVotes: v.number(),
    // Replace single round title with an array of round objects
    rounds: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        imageKey: v.optional(v.string()), // UPDATED: Expects the R2 key
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be logged in to create a league.");
    }

    // 1. Create the league
    const leagueId = await ctx.db.insert("leagues", {
      name: args.name,
      description: args.description,
      isPublic: args.isPublic,
      creatorId: userId,
      submissionDeadline: args.submissionDeadline,
      votingDeadline: args.votingDeadline,
      maxPositiveVotes: args.maxPositiveVotes,
      maxNegativeVotes: args.maxNegativeVotes,
    });

    // 2. Create all initial rounds for this league
    let submissionTime = Date.now();
    for (const round of args.rounds) {
      const submissionDeadlineTimestamp =
        submissionTime + daysToMs(args.submissionDeadline);
      const votingDeadlineTimestamp =
        submissionDeadlineTimestamp + daysToMs(args.votingDeadline);

      await ctx.db.insert("rounds", {
        leagueId: leagueId,
        title: round.title,
        description: round.description,
        imageKey: round.imageKey, // Store the R2 key
        status: "submissions",
        submissionDeadline: submissionDeadlineTimestamp,
        votingDeadline: votingDeadlineTimestamp,
      });

      // Stagger the start of the next round
      submissionTime = votingDeadlineTimestamp;
    }

    return leagueId;
  },
});

export const getLeaguesForUser = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"leagues">>> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const leagues = await ctx.db
      .query("leagues")
      .withIndex("by_creator", (q) => q.eq("creatorId", userId))
      .collect();

    return leagues;
  },
});

export const get = query({
  args: { id: v.id("leagues") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("leagues"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.string(),
      isPublic: v.boolean(),
      creatorId: v.id("users"),
      submissionDeadline: v.number(),
      votingDeadline: v.number(),
      maxPositiveVotes: v.number(),
      maxNegativeVotes: v.number(),
      creatorName: v.string(),
      memberCount: v.number(),
      isOwner: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const league = await ctx.db.get(args.id);

    if (!league) {
      return null;
    }

    const creator = await ctx.db.get(league.creatorId);

    // TODO: Implement member count logic
    return {
      ...league,
      creatorName: creator?.name ?? "Unknown",
      memberCount: 1, // Placeholder for now
      isOwner: userId === league.creatorId,
    };
  },
});