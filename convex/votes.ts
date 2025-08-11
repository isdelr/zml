import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc } from "./_generated/dataModel";
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

    // --- MODIFICATION START ---
    // Check if the user has a submission in this round to handle legacy cases.
    const userSubmission = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", args.roundId).eq("userId", userId),
      )
      .first();

    // A user can vote if they joined before the round started OR if they have a submission.
    const joinedEarly = membership?.joinDate
      ? membership.joinDate < round.submissionDeadline
      : false;
    const hasLegacySubmission = !!userSubmission;
    const canVote = joinedEarly || hasLegacySubmission;
    // --- MODIFICATION END ---

    const userVotes = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", args.roundId).eq("userId", userId),
      )
      .collect();

    const upvotesUsed = userVotes.filter((v) => v.vote > 0).length;
    const downvotesUsed = userVotes.filter((v) => v.vote < 0).length;

    // A user has "voted" (i.e., their vote is final) when they use all their votes.
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

    const users = await Promise.all(
      userIds.map(async (userId) => {
        return await ctx.db.get(userId);
      }),
    );
    return users
      .filter((user): user is Doc<"users"> => user !== null)
      .map((user) => ({
        _id: user._id,
        name: user.name,
        image: user.image,
      }));
  },
});

export const castVote = mutation({
  args: {
    submissionId: v.id("submissions"),
    newVoteState: v.union(
      v.literal("up"),
      v.literal("down"),
      v.literal("none"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("Submission not found.");

    const round = await ctx.db.get(submission.roundId);
    if (!round) throw new Error("Round not found.");
    if (round.status !== "voting") throw new Error("Voting is not open.");

    if (submission.userId === userId)
      throw new Error("You cannot vote on your own submission.");

    const league = await ctx.db.get(round.leagueId);
    if (!league) throw new Error("League not found.");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_league_and_user", (q) =>
        q.eq("leagueId", round.leagueId).eq("userId", userId),
      )
      .first();

    // We fetch the user's submission to check for the legacy case here as well.
    const userSubmission = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", round._id).eq("userId", userId),
      )
      .first();

    const canVote =
      (membership?.joinDate &&
        membership.joinDate < round.submissionDeadline) ||
      !!userSubmission;

    if (!canVote) {
      throw new Error("You are not eligible to vote in this round.");
    }

    const allUserVotesInRound = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", round._id).eq("userId", userId),
      )
      .collect();

    const existingVoteOnThisSubmission = allUserVotesInRound.find(
      (v) => v.submissionId === args.submissionId,
    );

    let voteDelta = 0;

    const upvotesUsedSoFar = allUserVotesInRound.filter(
      (v) => v.vote > 0,
    ).length;
    const downvotesUsedSoFar = allUserVotesInRound.filter(
      (v) => v.vote < 0,
    ).length;

    if (
      upvotesUsedSoFar === league.maxPositiveVotes &&
      downvotesUsedSoFar === league.maxNegativeVotes
    ) {
      throw new Error("Your votes are final and cannot be changed.");
    }

    if (existingVoteOnThisSubmission) {
      voteDelta -= existingVoteOnThisSubmission.vote;
      await ctx.db.delete(existingVoteOnThisSubmission._id);
    }

    const otherVotes = allUserVotesInRound.filter(
      (v) => v.submissionId !== args.submissionId,
    );
    const upvotesUsed = otherVotes.filter((v) => v.vote > 0).length;
    const downvotesUsed = otherVotes.filter((v) => v.vote < 0).length;

    if (args.newVoteState === "up") {
      if (upvotesUsed >= league.maxPositiveVotes) {
        if (existingVoteOnThisSubmission)
          await ctx.db.insert("votes", {
            ...existingVoteOnThisSubmission,
            _id: undefined,
            _creationTime: undefined,
          } as any);
        throw new Error("No upvotes remaining.");
      }
      await ctx.db.insert("votes", {
        roundId: round._id,
        submissionId: args.submissionId,
        userId,
        vote: 1,
      });
      voteDelta += 1;
    } else if (args.newVoteState === "down") {
      if (downvotesUsed >= league.maxNegativeVotes) {
        if (existingVoteOnThisSubmission)
          await ctx.db.insert("votes", {
            ...existingVoteOnThisSubmission,
            _id: undefined,
            _creationTime: undefined,
          } as any);
        throw new Error("No downvotes remaining.");
      }
      await ctx.db.insert("votes", {
        roundId: round._id,
        submissionId: args.submissionId,
        userId,
        vote: -1,
      });
      voteDelta -= 1;
    }

    if (voteDelta !== 0) {
      await submissionScoreCounter.add(ctx, args.submissionId, voteDelta);
    }

    const finalVotes = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", round._id).eq("userId", userId),
      )
      .collect();
    const finalUpvotes = finalVotes.filter((v) => v.vote > 0).length;
    const finalDownvotes = finalVotes.filter((v) => v.vote < 0).length;

    const currentUserFinishedVoting =
      finalUpvotes === league.maxPositiveVotes &&
      finalDownvotes === league.maxNegativeVotes;

    if (currentUserFinishedVoting) {
      const allSubmissionsInRound = await ctx.db
        .query("submissions")
        .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
        .collect();

      if (allSubmissionsInRound.length === 0) {
        return {
          message: "All votes used. Your participation is recorded!",
          isFinal: true,
        };
      }

      const submitterIds = [
        ...new Set(allSubmissionsInRound.map((s) => s.userId)),
      ];

      const allVotesInRound = await ctx.db
        .query("votes")
        .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
        .collect();

      let allSubmittersHaveVoted = true;
      for (const submitterId of submitterIds) {
        const submitterVotes = allVotesInRound.filter(
          (v) => v.userId === submitterId,
        );
        const submitterUpvotes = submitterVotes.filter(
          (v) => v.vote > 0,
        ).length;
        const submitterDownvotes = submitterVotes.filter(
          (v) => v.vote < 0,
        ).length;

        if (
          submitterUpvotes < league.maxPositiveVotes ||
          submitterDownvotes < league.maxNegativeVotes
        ) {
          allSubmittersHaveVoted = false;
          break;
        }
      }

      if (allSubmittersHaveVoted) {
        await ctx.db.patch(round._id, { status: "finished" });

        await ctx.scheduler.runAfter(
          0,
          internal.leagues.calculateAndStoreResults,
          {
            roundId: round._id,
          },
        );

        await ctx.scheduler.runAfter(
          0,
          internal.notifications.createForLeague,
          {
            leagueId: league._id,
            type: "round_finished",
            message: `The round "${round.title}" in "${league.name}" has finished automatically! Check out the results.`,
            link: `/leagues/${league._id}/round/${round._id}`,
            triggeringUserId: userId,
          },
        );

        return {
          message: "Your vote was the last one! The round is now finished.",
          isFinal: true,
        };
      }

      return {
        message: "All votes used. Your participation is recorded!",
        isFinal: true,
      };
    }

    return { message: "Vote saved.", isFinal: false };
  },
});
