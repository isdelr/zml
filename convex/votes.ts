// convex/votes.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { voterCounter } from "./counters";

export const getForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const votes = await ctx.db.query("votes").withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId)).collect();
    return votes;
  },
});

export const getForUserInRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { hasVoted: false, canVote: false, votes: [], upvotesUsed: 0, downvotesUsed: 0 };
    }
    const round = await ctx.db.get(args.roundId);
    if (!round) {
      return { hasVoted: false, canVote: false, votes: [], upvotesUsed: 0, downvotesUsed: 0 };
    }
    const league = await ctx.db.get(round.leagueId);
    if (!league) {
      throw new Error("Could not find league for this round");
    }
    const maxUp = (round as any).maxPositiveVotes ?? league.maxPositiveVotes;
    const maxDown = (round as any).maxNegativeVotes ?? league.maxNegativeVotes;
    const userSubmission = await ctx.db.query("submissions").withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId).eq("userId", userId)).first();
    const canVote = !!userSubmission;

    const userVotes = await ctx.db.query("votes").withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId).eq("userId", userId)).collect();
    const upvotesUsed = userVotes.reduce((sum, v) => sum + Math.max(0, v.vote), 0);
    const downvotesUsed = userVotes.reduce((sum, v) => sum + Math.abs(Math.min(0, v.vote)), 0);
    const hasVoted = upvotesUsed === maxUp && downvotesUsed === maxDown;

    return { hasVoted, canVote, votes: userVotes, upvotesUsed, downvotesUsed };
  },
});

export const getVotersForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round) return [];
    const league = await ctx.db.get(round.leagueId);
    if (!league) return [];

    const maxUp = (round as any).maxPositiveVotes ?? league.maxPositiveVotes;
    const maxDown = (round as any).maxNegativeVotes ?? league.maxNegativeVotes;

    const votes = await ctx.db.query("votes").withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId)).collect();
    if (votes.length === 0) {
      return [];
    }

    const sums = new Map<string, { up: number; down: number }>();
    for (const vte of votes) {
      const key = vte.userId.toString();
      const entry = sums.get(key) ?? { up: 0, down: 0 };
      if (vte.vote > 0) entry.up += vte.vote;
      else if (vte.vote < 0) entry.down += Math.abs(vte.vote);
      sums.set(key, entry);
    }

    const finalizedUserIds: Id<"users">[] = [];
    for (const [userIdStr, { up, down }] of sums.entries()) {
      if (up === maxUp && down === maxDown) {
        finalizedUserIds.push(userIdStr as unknown as Id<"users">);
      }
    }
    if (finalizedUserIds.length === 0) {
      return [];
    }
    const users = await Promise.all(finalizedUserIds.map((id) => ctx.db.get(id)));
    return users.filter((u): u is Doc<"users"> => u !== null).map((user) => ({ _id: user._id, name: user.name, image: user.image }));
  },
});

export const castVote = mutation({
  args: {
    submissionId: v.id("submissions"),
    delta: v.union(v.literal(1), v.literal(-1)),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("Submission not found.");

    // Prevent voting on troll submissions
    if (submission.isTrollSubmission) {
      throw new Error("You cannot vote on submissions marked as troll submissions.");
    }

    const round = await ctx.db.get(submission.roundId);
    if (!round) throw new Error("Round not found.");
    if (round.status !== "voting") throw new Error("Voting is not open.");

    if (submission.userId === userId) {
      throw new Error("You cannot vote on your own submission.");
    }

    const league = await ctx.db.get(submission.leagueId);
    if (!league) throw new Error("League not found.");

    const maxUp = (round as any).maxPositiveVotes ?? league.maxPositiveVotes;
    const maxDown = (round as any).maxNegativeVotes ?? league.maxNegativeVotes;

    const userSubmission = await ctx.db.query("submissions").withIndex("by_round_and_user", (q) => q.eq("roundId", round._id).eq("userId", userId)).first();
    if (!userSubmission) {
      throw new Error("You must submit a song in this round to be able to vote.");
    }

    if (league.enforceListenPercentage) {
      const allSubs = await ctx.db.query("submissions").withIndex("by_round_and_user", (q) => q.eq("roundId", round._id)).collect();
      const requiredSubs = allSubs.filter((s) => ["file", "youtube"].includes(s.submissionType) && s.userId !== userId && !s.isTrollSubmission);
      if (requiredSubs.length > 0) {
        const progressDocs = await Promise.all(
          requiredSubs.map((s) => ctx.db.query("listenProgress").withIndex("by_user_and_submission", (q) => q.eq("userId", userId).eq("submissionId", s._id)).first()),
        );
        const allCompleted = progressDocs.every((p) => p !== null && p.isCompleted);
        if (!allCompleted) {
          throw new Error("You must listen to the required portion of all submissions before voting. For YouTube links, use the Play button to open the link so your listening can be tracked.");
        }
      }
    }

    const allUserVotesInRound = await ctx.db.query("votes").withIndex("by_round_and_user", (q) => q.eq("roundId", round._id).eq("userId", userId)).collect();
    const upUsedSoFar = allUserVotesInRound.reduce((sum, v) => sum + Math.max(0, v.vote), 0);
    const downUsedSoFar = allUserVotesInRound.reduce((sum, v) => sum + Math.abs(Math.min(0, v.vote)), 0);
    if (upUsedSoFar === maxUp && downUsedSoFar === maxDown) {
      throw new Error("Your votes are final and cannot be changed.");
    }

    const existingVote = allUserVotesInRound.find((v) => v.submissionId === args.submissionId);
    const otherVotes = allUserVotesInRound.filter((v) => v.submissionId !== args.submissionId);
    const current = existingVote?.vote ?? 0;
    const newVote = current + args.delta;

    if (league.limitVotesPerSubmission) {
      if (args.delta === 1) {
        if (newVote > (league.maxPositiveVotesPerSubmission ?? 1)) {
          throw new Error("You have reached the maximum number of upvotes for this song.");
        }
      }
      if (args.delta === -1) {
        if (Math.abs(newVote) > (league.maxNegativeVotesPerSubmission ?? 0)) {
          throw new Error("You have reached the maximum number of downvotes for this song.");
        }
      }
    }

    const otherPos = otherVotes.reduce((sum, v) => sum + Math.max(0, v.vote), 0);
    const otherNeg = otherVotes.reduce((sum, v) => sum + Math.abs(Math.min(0, v.vote)), 0);
    const newPosUsed = otherPos + Math.max(0, newVote);
    const newNegUsed = otherNeg + Math.abs(Math.min(0, newVote));

    if (args.delta === 1 && newPosUsed > maxUp) {
      throw new Error("No upvotes remaining.");
    }
    if (args.delta === -1 && newNegUsed > maxDown) {
      throw new Error("No downvotes remaining.");
    }

    if (existingVote) {
      if (newVote === 0) {
        await ctx.db.delete(existingVote._id);
      } else {
        await ctx.db.patch(existingVote._id, { vote: newVote });
      }
    } else {
      if (newVote !== 0) {
        await ctx.db.insert("votes", {
          roundId: round._id,
          submissionId: args.submissionId,
          userId,
          vote: newVote,
        });
      }
    }

    const finalVotes = await ctx.db.query("votes").withIndex("by_round_and_user", (q) => q.eq("roundId", round._id).eq("userId", userId)).collect();
    const finalUp = finalVotes.reduce((sum, v) => sum + Math.max(0, v.vote), 0);
    const finalDown = finalVotes.reduce((sum, v) => sum + Math.abs(Math.min(0, v.vote)), 0);
    const currentUserFinishedVoting = finalUp === maxUp && finalDown === maxDown;

    if (currentUserFinishedVoting) {
      await voterCounter.inc(ctx, round._id);
      const allVotesInRound = await ctx.db.query("votes").withIndex("by_round_and_user", (q) => q.eq("roundId", round._id)).collect();
      const allSubmissionsInRound = await ctx.db.query("submissions").withIndex("by_round_and_user", (q) => q.eq("roundId", round._id)).collect();
      const submitterIds = [...new Set(allSubmissionsInRound.map((s) => s.userId))];

      let allSubmittersHaveVoted = true;
      for (const submitterId of submitterIds) {
        const submitterVotes = allVotesInRound.filter((v) => v.userId === submitterId);
        const submitterUp = submitterVotes.reduce((sum, v) => sum + Math.max(0, v.vote), 0);
        const submitterDown = submitterVotes.reduce((sum, v) => sum + Math.abs(Math.min(0, v.vote)), 0);
        if (submitterUp < maxUp || submitterDown < maxDown) {
          allSubmittersHaveVoted = false;
          break;
        }
      }

      if (allSubmittersHaveVoted) {
        await ctx.db.patch(round._id, { status: "finished" });
        await ctx.scheduler.runAfter(0, internal.leagues.calculateAndStoreResults, { roundId: round._id });
        await ctx.scheduler.runAfter(0, internal.notifications.createForLeague, {
          leagueId: league._id,
          type: "round_finished",
          message: `The round "${round.title}" in "${league.name}" has finished automatically! Check out the results.`,
          link: `/leagues/${league._id}/round/${round._id}`,
          triggeringUserId: userId,
        });
        return { message: "Your vote was the last one! The round is now finished.", isFinal: true };
      }
      return { message: "All votes used. Your participation is recorded!", isFinal: true };
    }

    return { message: "Vote saved.", isFinal: false };
  },
});