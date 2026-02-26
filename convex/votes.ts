// convex/votes.ts
import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { getAuthUserId } from "./authCore";
import { Doc, Id } from "./_generated/dataModel";
import { voterCounter } from "./counters";
import { getVoteLimits } from "../lib/convex-server/voteLimits";
import { transitionRoundToFinishedWithSideEffects } from "../lib/convex-server/rounds/transitions";
import { B2Storage } from "./b2Storage";
import { resolveUserAvatarUrl } from "./userAvatar";

const storage = new B2Storage();

async function canViewLeague(
  ctx: Pick<QueryCtx, "db">,
  leagueId: Id<"leagues">,
  userId: Id<"users"> | null,
) {
  const league = await ctx.db.get("leagues", leagueId);
  if (!league) {
    return { league: null, canView: false as const };
  }

  if (league.isPublic) {
    return { league, canView: true as const };
  }

  if (!userId) {
    return { league, canView: false as const };
  }

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_league_and_user", (q) =>
      q.eq("leagueId", leagueId).eq("userId", userId),
    )
    .first();

  return { league, canView: Boolean(membership) };
}

async function canManageLeague(
  ctx: Pick<QueryCtx, "db">,
  league: Doc<"leagues">,
  userId: Id<"users"> | null,
) {
  if (!userId) {
    return false;
  }

  if (league.creatorId === userId) {
    return true;
  }

  if (league.managers?.includes(userId)) {
    return true;
  }

  const user = await ctx.db.get("users", userId);
  return Boolean(user?.isGlobalAdmin);
}

export const getForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) {
      return [];
    }

    const { league, canView } = await canViewLeague(
      ctx,
      round.leagueId,
      userId,
    );
    if (!league || !canView) {
      return [];
    }

    const canManage = await canManageLeague(ctx, league, userId);
    if (!canManage) {
      return [];
    }

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
    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) {
      return {
        hasVoted: false,
        canVote: false,
        votes: [],
        upvotesUsed: 0,
        downvotesUsed: 0,
      };
    }
    const { league, canView } = await canViewLeague(
      ctx,
      round.leagueId,
      userId,
    );
    if (!league || !canView) {
      return {
        hasVoted: false,
        canVote: false,
        votes: [],
        upvotesUsed: 0,
        downvotesUsed: 0,
      };
    }

    const { maxUp, maxDown } = getVoteLimits(round, league);
    const userSubmission = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", args.roundId).eq("userId", userId),
      )
      .first();
    const canVote = !!userSubmission;

    const userVotes = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", args.roundId).eq("userId", userId),
      )
      .collect();
    const upvotesUsed = userVotes.reduce(
      (sum, v) => sum + Math.max(0, v.vote),
      0,
    );
    const downvotesUsed = userVotes.reduce(
      (sum, v) => sum + Math.abs(Math.min(0, v.vote)),
      0,
    );
    const hasVoted = upvotesUsed === maxUp && downvotesUsed === maxDown;

    return { hasVoted, canVote, votes: userVotes, upvotesUsed, downvotesUsed };
  },
});

export const getVotersForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) return [];
    const { league, canView } = await canViewLeague(
      ctx,
      round.leagueId,
      userId,
    );
    if (!league || !canView) return [];

    const { maxUp, maxDown } = getVoteLimits(round, league);

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
      .collect();
    if (votes.length === 0) {
      return [];
    }

    const sums = new Map<
      string,
      { userId: Id<"users">; up: number; down: number }
    >();
    for (const vte of votes) {
      const key = vte.userId.toString();
      const entry = sums.get(key) ?? { userId: vte.userId, up: 0, down: 0 };
      if (vte.vote > 0) entry.up += vte.vote;
      else if (vte.vote < 0) entry.down += Math.abs(vte.vote);
      sums.set(key, entry);
    }

    const finalizedUserIds: Id<"users">[] = [];
    for (const { userId, up, down } of sums.values()) {
      if (up === maxUp && down === maxDown) {
        finalizedUserIds.push(userId);
      }
    }
    if (finalizedUserIds.length === 0) {
      return [];
    }
    const users = await Promise.all(
      finalizedUserIds.map((id) => ctx.db.get("users", id)),
    );
    const finalizedUsers = users.filter((u): u is Doc<"users"> => u !== null);
    return Promise.all(
      finalizedUsers.map(async (user) => ({
        _id: user._id,
        name: user.name,
        image: await resolveUserAvatarUrl(storage, user),
      })),
    );
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

    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) throw new Error("Submission not found.");

    // Prevent voting on troll submissions
    if (submission.isTrollSubmission) {
      throw new Error(
        "You cannot vote on submissions marked as troll submissions.",
      );
    }

    const round = await ctx.db.get("rounds", submission.roundId);
    if (!round) throw new Error("Round not found.");
    if (round.status !== "voting") throw new Error("Voting is not open.");

    if (submission.userId === userId) {
      throw new Error("You cannot vote on your own submission.");
    }

    const league = await ctx.db.get("leagues", submission.leagueId);
    if (!league) throw new Error("League not found.");

    // Check if user is a spectator
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_league_and_user", (q) =>
        q.eq("leagueId", league._id).eq("userId", userId),
      )
      .first();

    if (membership?.isSpectator) {
      throw new Error(
        "Spectators cannot vote. Join as a full member to participate.",
      );
    }

    const { maxUp, maxDown } = getVoteLimits(round, league);

    const userSubmission = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", round._id).eq("userId", userId),
      )
      .first();
    if (!userSubmission) {
      throw new Error(
        "You must submit a song in this round to be able to vote.",
      );
    }

    if (league.enforceListenPercentage) {
      const allSubs = await ctx.db
        .query("submissions")
        .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
        .collect();
      const requiredSubs = allSubs.filter(
        (s) =>
          ["file", "youtube"].includes(s.submissionType) &&
          s.userId !== userId &&
          !s.isTrollSubmission,
      );
      if (requiredSubs.length > 0) {
        const progressDocs = await ctx.db
          .query("listenProgress")
          .withIndex("by_round_and_user", (q) =>
            q.eq("roundId", round._id).eq("userId", userId),
          )
          .collect();
        const progressBySubmissionId = new Map(
          progressDocs.map((progress) => [
            progress.submissionId.toString(),
            progress,
          ]),
        );
        const allCompleted = requiredSubs.every((submissionDoc) => {
          const progressDoc = progressBySubmissionId.get(
            submissionDoc._id.toString(),
          );
          return progressDoc !== undefined && progressDoc.isCompleted;
        });
        if (!allCompleted) {
          throw new Error(
            "You must listen to the required portion of all submissions before voting. For YouTube links, use the Play button to open the link so your listening can be tracked.",
          );
        }
      }
    }

    const allUserVotesInRound = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", round._id).eq("userId", userId),
      )
      .collect();
    const upUsedSoFar = allUserVotesInRound.reduce(
      (sum, v) => sum + Math.max(0, v.vote),
      0,
    );
    const downUsedSoFar = allUserVotesInRound.reduce(
      (sum, v) => sum + Math.abs(Math.min(0, v.vote)),
      0,
    );
    if (upUsedSoFar === maxUp && downUsedSoFar === maxDown) {
      throw new Error("Your votes are final and cannot be changed.");
    }

    const existingVote = allUserVotesInRound.find(
      (v) => v.submissionId === args.submissionId,
    );
    const otherVotes = allUserVotesInRound.filter(
      (v) => v.submissionId !== args.submissionId,
    );
    const current = existingVote?.vote ?? 0;
    const newVote = current + args.delta;

    if (league.limitVotesPerSubmission) {
      if (args.delta === 1) {
        if (newVote > (league.maxPositiveVotesPerSubmission ?? 1)) {
          throw new Error(
            "You have reached the maximum number of upvotes for this song.",
          );
        }
      }
      if (args.delta === -1) {
        if (Math.abs(newVote) > (league.maxNegativeVotesPerSubmission ?? 0)) {
          throw new Error(
            "You have reached the maximum number of downvotes for this song.",
          );
        }
      }
    }

    const otherPos = otherVotes.reduce(
      (sum, v) => sum + Math.max(0, v.vote),
      0,
    );
    const otherNeg = otherVotes.reduce(
      (sum, v) => sum + Math.abs(Math.min(0, v.vote)),
      0,
    );
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
        await ctx.db.delete("votes", existingVote._id);
      } else {
        await ctx.db.patch("votes", existingVote._id, { vote: newVote });
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

    const finalVotes = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", round._id).eq("userId", userId),
      )
      .collect();
    const finalUp = finalVotes.reduce((sum, v) => sum + Math.max(0, v.vote), 0);
    const finalDown = finalVotes.reduce(
      (sum, v) => sum + Math.abs(Math.min(0, v.vote)),
      0,
    );
    const currentUserFinishedVoting =
      finalUp === maxUp && finalDown === maxDown;

    if (currentUserFinishedVoting) {
      await voterCounter.inc(ctx, round._id);
      const allVotesInRound = await ctx.db
        .query("votes")
        .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
        .collect();
      const allSubmissionsInRound = await ctx.db
        .query("submissions")
        .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
        .collect();
      const submitterIds = [
        ...new Set(allSubmissionsInRound.map((s) => s.userId)),
      ];

      let allSubmittersHaveVoted = true;
      for (const submitterId of submitterIds) {
        const submitterVotes = allVotesInRound.filter(
          (v) => v.userId === submitterId,
        );
        const submitterUp = submitterVotes.reduce(
          (sum, v) => sum + Math.max(0, v.vote),
          0,
        );
        const submitterDown = submitterVotes.reduce(
          (sum, v) => sum + Math.abs(Math.min(0, v.vote)),
          0,
        );
        if (submitterUp < maxUp || submitterDown < maxDown) {
          allSubmittersHaveVoted = false;
          break;
        }
      }

      if (allSubmittersHaveVoted) {
        await transitionRoundToFinishedWithSideEffects(ctx, round, league, {
          triggeringUserId: userId,
          notificationMessage: `The round "${round.title}" in "${league.name}" has finished automatically! Check out the results.`,
        });
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
