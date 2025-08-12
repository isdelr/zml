import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { submissionScoreCounter } from "./counters";

export const getForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
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
        canVote: false,
        votes: [],
        upvotesUsed: 0,
        downvotesUsed: 0,
      };
    }

    const round = await ctx.db.get(args.roundId);
    if (!round) {
      return {
        hasVoted: false,
        canVote: false,
        votes: [],
        upvotesUsed: 0,
        downvotesUsed: 0,
      };
    }

    const league = await ctx.db.get(round.leagueId);
    if (!league) {
      throw new Error("Could not find league for this round");
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_league_and_user", (q) =>
        q.eq("leagueId", round.leagueId).eq("userId", userId),
      )
      .first();

    // User can vote if they joined before submissions closed OR they have a submission in this round (legacy/backfill case)
    const userSubmission = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", args.roundId).eq("userId", userId),
      )
      .first();

    const joinedEarly =
      membership?.joinDate ? membership.joinDate < round.submissionDeadline : false;
    const canVote = joinedEarly || !!userSubmission;

    const userVotes = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", args.roundId).eq("userId", userId),
      )
      .collect();

    // Sum magnitudes instead of counting docs (supports stacking)
    const upvotesUsed = userVotes.reduce((sum, v) => sum + Math.max(0, v.vote), 0);
    const downvotesUsed = userVotes.reduce((sum, v) => sum + Math.abs(Math.min(0, v.vote)), 0);

    const hasVoted =
      upvotesUsed === league.maxPositiveVotes &&
      downvotesUsed === league.maxNegativeVotes;

    return {
      hasVoted,
      canVote,
      votes: userVotes,
      upvotesUsed,
      downvotesUsed,
    };
  },
});

export const getVotersForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
      .collect();

    if (votes.length === 0) {
      return [];
    }
    const userIds = [...new Set(votes.map((vote) => vote.userId))];

    const users = await Promise.all(userIds.map(async (userId) => ctx.db.get(userId)));
    return users
      .filter((u): u is Doc<"users"> => u !== null)
      .map((user) => ({
        _id: user._id,
        name: user.name,
        image: user.image,
      }));
  },
});

/**
 * New voting semantics:
 * - Each click is a delta (+1 for up arrow, -1 for down arrow).
 * - A single vote document per (user, submission) stores an integer "vote" that can be negative, zero, or positive.
 * - Totals across a round are constrained by league.maxPositiveVotes/maxNegativeVotes.
 * - You cannot have both positive and negative votes on the same song at the same time (enforced by the single signed integer).
 */
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

    const round = await ctx.db.get(submission.roundId);
    if (!round) throw new Error("Round not found.");
    if (round.status !== "voting") throw new Error("Voting is not open.");

    if (submission.userId === userId) {
      throw new Error("You cannot vote on your own submission.");
    }

    const league = await ctx.db.get(submission.leagueId);
    if (!league) throw new Error("League not found.");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_league_and_user", (q) =>
        q.eq("leagueId", round.leagueId).eq("userId", userId),
      )
      .first();

    // Legacy allowance: if user submitted in this round, let them vote even if they joined late.
    const userSubmission = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", round._id).eq("userId", userId),
      )
      .first();

    const canVote =
      (membership?.joinDate && membership.joinDate < round.submissionDeadline) ||
      !!userSubmission;

    if (!canVote) {
      throw new Error("You are not eligible to vote in this round.");
    }

    // Enforce listening requirement across all file submissions before any voting
    if (league.enforceListenPercentage) {
      const allSubs = await ctx.db
        .query("submissions")
        .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
        .collect();

      const requiredSubs = allSubs.filter((s) => s.userId !== userId && s.submissionType === "file");

      if (requiredSubs.length > 0) {
        const progressDocs = await Promise.all(
          requiredSubs.map((s) =>
            ctx.db
              .query("listenProgress")
              .withIndex("by_user_and_submission", (q) =>
                q.eq("userId", userId).eq("submissionId", s._id),
              )
              .first(),
          ),
        );

        const allCompleted = progressDocs.every((p) => p !== null && p.isCompleted);
        if (!allCompleted) {
          throw new Error(
            "You must listen to the required portion of all file submissions before voting.",
          );
        }
      }
    }

    // Lock once full budgets are used
    const allUserVotesInRound = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id).eq("userId", userId))
      .collect();

    const upUsedSoFar = allUserVotesInRound.reduce((sum, v) => sum + Math.max(0, v.vote), 0);
    const downUsedSoFar = allUserVotesInRound.reduce(
      (sum, v) => sum + Math.abs(Math.min(0, v.vote)),
      0,
    );
    if (upUsedSoFar === league.maxPositiveVotes && downUsedSoFar === league.maxNegativeVotes) {
      throw new Error("Your votes are final and cannot be changed.");
    }

    // Current vote for this submission (single doc), others for budget calculations
    const existingVote = allUserVotesInRound.find((v) => v.submissionId === args.submissionId);
    const otherVotes = allUserVotesInRound.filter((v) => v.submissionId !== args.submissionId);

    const current = existingVote?.vote ?? 0;
    const newVote = current + args.delta;
    
    // --- NEW LOGIC START ---
    // Check per-submission vote limits if enabled
    if (league.limitVotesPerSubmission) {
      if (args.delta === 1) { // Trying to upvote
        if (newVote > (league.maxPositiveVotesPerSubmission ?? 1)) {
          throw new Error("You have reached the maximum number of upvotes for this song.");
        }
      }
      if (args.delta === -1) { // Trying to downvote
        if (Math.abs(newVote) > (league.maxNegativeVotesPerSubmission ?? 1)) {
          throw new Error("You have reached the maximum number of downvotes for this song.");
        }
      }
    }
    // --- NEW LOGIC END ---

    // Compute budget usage excluding this submission, then add the newVote parts
    const otherPos = otherVotes.reduce((sum, v) => sum + Math.max(0, v.vote), 0);
    const otherNeg = otherVotes.reduce((sum, v) => sum + Math.abs(Math.min(0, v.vote)), 0);

    const newPosUsed = otherPos + Math.max(0, newVote);
    const newNegUsed = otherNeg + Math.abs(Math.min(0, newVote));

    if (args.delta === 1 && newPosUsed > league.maxPositiveVotes) {
      throw new Error("No upvotes remaining.");
    }
    if (args.delta === -1 && newNegUsed > league.maxNegativeVotes) {
      // Note: this fires only when actually increasing negative usage (e.g., 0 -> -1, -1 -> -2, etc.).
      // If you're reducing positive usage (e.g., 2 -> 1), newNegUsed doesn't increase and this won't trip.
      throw new Error("No downvotes remaining.");
    }

    // Apply mutation
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

    // Update live score counter for the submission
    await submissionScoreCounter.add(ctx, args.submissionId, args.delta);

    // Recompute final usage to decide if user just finalized
    const finalVotes = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id).eq("userId", userId))
      .collect();

    const finalUp = finalVotes.reduce((sum, v) => sum + Math.max(0, v.vote), 0);
    const finalDown = finalVotes.reduce((sum, v) => sum + Math.abs(Math.min(0, v.vote)), 0);

    const currentUserFinishedVoting =
      finalUp === league.maxPositiveVotes && finalDown === league.maxNegativeVotes;

    if (currentUserFinishedVoting) {
      // If all submitters have finished, auto-finish the round.
      const allVotesInRound = await ctx.db
        .query("votes")
        .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
        .collect();

      const allSubmissionsInRound = await ctx.db
        .query("submissions")
        .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
        .collect();

      const submitterIds = [...new Set(allSubmissionsInRound.map((s) => s.userId))];

      let allSubmittersHaveVoted = true;
      for (const submitterId of submitterIds) {
        const submitterVotes = allVotesInRound.filter((v) => v.userId === submitterId);
        const submitterUp = submitterVotes.reduce((sum, v) => sum + Math.max(0, v.vote), 0);
        const submitterDown = submitterVotes.reduce(
          (sum, v) => sum + Math.abs(Math.min(0, v.vote)),
          0,
        );
        if (
          submitterUp < league.maxPositiveVotes ||
          submitterDown < league.maxNegativeVotes
        ) {
          allSubmittersHaveVoted = false;
          break;
        }
      }

      if (allSubmittersHaveVoted) {
        await ctx.db.patch(round._id, { status: "finished" });

        await ctx.scheduler.runAfter(0, internal.leagues.calculateAndStoreResults, {
          roundId: round._id,
        });

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