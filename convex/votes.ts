import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
      .collect();
    return votes;
  },
});

export const getForUserInRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        hasVoted: false,
        votes: [],
        upvotesUsed: 0,
        downvotesUsed: 0,
      };
    }

    const userVotes = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", args.roundId).eq("userId", userId),
      )
      .collect();

    const hasVoted = userVotes.length > 0;

    let upvotesUsed = 0;
    let downvotesUsed = 0;

    userVotes.forEach((v) => {
      if (v.vote > 0) upvotesUsed += 1;
      if (v.vote < 0) downvotesUsed += 1;
    });

    return {
      hasVoted,
      votes: userVotes,
      upvotesUsed,
      downvotesUsed,
    };
  },
});

export const submitVotes = mutation({
  args: {
    roundId: v.id("rounds"),
    votes: v.array(
      v.object({
        submissionId: v.id("submissions"),
        voteType: v.union(v.literal("up"), v.literal("down")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const round = await ctx.db.get(args.roundId);
    if (!round) throw new Error("Round not found.");
    if (round.status !== "voting") {
      throw new Error("Voting is not open for this round.");
    }

    const existingVotes = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", args.roundId).eq("userId", userId),
      )
      .collect();

    if (existingVotes.length > 0) {
      throw new Error("You have already voted and cannot change your votes.");
    }

    const league = await ctx.db.get(round.leagueId);
    if (!league) throw new Error("League not found.");

    const upvotesCount = args.votes.filter((v) => v.voteType === "up").length;
    const downvotesCount = args.votes.filter(
      (v) => v.voteType === "down",
    ).length;

    if (upvotesCount !== league.maxPositiveVotes) {
      throw new Error(
        `You must use exactly ${league.maxPositiveVotes} upvotes.`,
      );
    }
    if (downvotesCount !== league.maxNegativeVotes) {
      throw new Error(
        `You must use exactly ${league.maxNegativeVotes} downvotes.`,
      );
    }

    const userSubmission = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", args.roundId).eq("userId", userId),
      )
      .first();

    if (userSubmission) {
      const votedOnOwnSubmission = args.votes.some(
        (v) => v.submissionId === userSubmission._id,
      );
      if (votedOnOwnSubmission) {
        throw new Error("You cannot vote on your own submission.");
      }
    }

    for (const vote of args.votes) {
      await ctx.db.insert("votes", {
        roundId: args.roundId,
        submissionId: vote.submissionId,
        userId,
        vote: vote.voteType === "up" ? 1 : -1,
      });
    }

    return "Votes submitted successfully.";
  },
});