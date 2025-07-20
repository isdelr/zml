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

    let upvotesUsed = 0;
    let downvotesUsed = 0;

    userVotes.forEach((v) => {
      if (v.vote > 0) upvotesUsed++;
      if (v.vote < 0) downvotesUsed++;
    });

    return {
      votes: userVotes, // The actual vote documents
      upvotesUsed,
      downvotesUsed,
    };
  },
});

export const castVote = mutation({
  args: {
    submissionId: v.id("submissions"),
    voteType: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("Submission not found.");

    const round = await ctx.db.get(submission.roundId);
    if (!round || round.status !== "voting") {
      throw new Error("Voting is not open for this round.");
    }

    if (submission.userId === userId) {
      throw new Error("You cannot vote on your own submission.");
    }

    const league = await ctx.db.get(round.leagueId);
    if (!league) throw new Error("League not found.");

    const userVotes = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", round._id).eq("userId", userId),
      )
      .collect();

    const upvotesUsed = userVotes.filter((v) => v.vote > 0).length;
    const downvotesUsed = userVotes.filter((v) => v.vote < 0).length;

    const existingVote = userVotes.find(
      (v) => v.submissionId === args.submissionId,
    );
    const newVoteValue = args.voteType === "up" ? 1 : -1;

    if (existingVote) {
      if (existingVote.vote === newVoteValue) {
        await ctx.db.delete(existingVote._id);
        return "Vote removed.";
      } else {
        await ctx.db.patch(existingVote._id, { vote: newVoteValue });
        return "Vote changed.";
      }
    } else {
      if (args.voteType === "up" && upvotesUsed >= league.maxPositiveVotes) {
        throw new Error("You have no upvotes left.");
      }
      if (args.voteType === "down" && downvotesUsed >= league.maxNegativeVotes) {
        throw new Error("You have no downvotes left.");
      }

      await ctx.db.insert("votes", {
        roundId: round._id,
        submissionId: args.submissionId,
        userId,
        vote: newVoteValue,
      });
      return "Vote cast.";
    }
  },
});