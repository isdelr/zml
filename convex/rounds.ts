import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { R2 } from "@convex-dev/r2";
import { components, internal } from "./_generated/api";

const r2 = new R2(components.r2);

const daysToMs = (days: number) => days * 24 * 60 * 60 * 1000;

const checkOwnership = async (
  ctx: MutationCtx | QueryCtx,
  leagueId: Id<"leagues">,
) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated.");
  }
  const league = await ctx.db.get(leagueId);
  if (!league) {
    throw new Error("League not found.");
  }
  if (league.creatorId !== userId) {
    throw new Error("You are not the owner of this league.");
  }
  return { league, userId };
};

export const create = mutation({
  args: {
    leagueId: v.id("leagues"),
    title: v.string(),
    description: v.string(),
    genres: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { league, userId } = await checkOwnership(ctx, args.leagueId);

    const now = Date.now();
    const submissionDeadline = now + daysToMs(league.submissionDeadline);
    const votingDeadline = submissionDeadline + daysToMs(league.votingDeadline);

    const roundId = await ctx.db.insert("rounds", {
      leagueId: args.leagueId,
      title: args.title,
      description: args.description,
      genres: args.genres,
      status: "submissions",
      submissionDeadline,
      votingDeadline,
    });

    await ctx.scheduler.runAfter(0, internal.notifications.createForLeague, {
      leagueId: league._id,
      type: "round_submission",
      message: `A new round, "${args.title}", has started in "${league.name}"!`,
      link: `/leagues/${league._id}/round/${roundId}`,
      triggeringUserId: userId,
    });

    return roundId;
  },
});

export const getRoundMetadata = query({
  args: { roundId: v.id("rounds") },
  returns: v.union(
    v.null(),
    v.object({
      roundTitle: v.string(),
      roundDescription: v.string(),
      imageUrl: v.union(v.string(), v.null()),
      leagueName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round) {
      return null;
    }

    const league = await ctx.db.get(round.leagueId);
    if (!league) {
      return null;
    }

    const imageUrl = round.imageKey ? await r2.getUrl(round.imageKey) : null;

    return {
      roundTitle: round.title,
      roundDescription: round.description,
      imageUrl,
      leagueName: league.name,
    };
  },
});

export const getForLeague = query({
  args: { leagueId: v.id("leagues") },
  handler: async (ctx, args) => {
    const rounds = await ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .order("desc")
      .collect();

    // Fetch all submissions for all rounds in this league in a single query
    const roundIds = rounds.map((r) => r._id);
    const allSubmissions = (
      await Promise.all(
        roundIds.map((roundId) =>
          ctx.db
            .query("submissions")
            .withIndex("by_round_and_user", (q) => q.eq("roundId", roundId))
            .collect(),
        ),
      )
    ).flat();

    // Group submissions by roundId for easy lookup
    const submissionsByRound = allSubmissions.reduce(
      (acc, submission) => {
        const roundId = submission.roundId.toString();
        if (!acc[roundId]) {
          acc[roundId] = 0;
        }
        acc[roundId]++;
        return acc;
      },
      {} as Record<string, number>,
    );

    const roundsWithDetails = await Promise.all(
      rounds.map(async (round) => {
        const artUrl =
          (round.imageKey && (await r2.getUrl(round.imageKey))) || null;
        return {
          ...round,

          submissionCount: submissionsByRound[round._id.toString()] ?? 0,
          art: artUrl,
        };
      }),
    );
    return roundsWithDetails;
  },
});

export const getActiveForUser = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<Doc<"rounds"> & { leagueName: string; art: string | null }>
  > => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (memberships.length === 0) return [];
    const leagueIds = memberships.map((m) => m.leagueId);
    const userLeagues = (
      await Promise.all(leagueIds.map((leagueId) => ctx.db.get(leagueId)))
    ).filter((l): l is Doc<"leagues"> => l !== null);
    if (userLeagues.length === 0) return [];
    const allActiveRounds: Array<
      Doc<"rounds"> & { leagueName: string; art: string | null }
    > = [];
    for (const league of userLeagues) {
      const rounds = await ctx.db
        .query("rounds")
        .withIndex("by_league", (q) => q.eq("leagueId", league._id))
        .filter((q) => q.neq(q.field("status"), "finished"))
        .collect();
      for (const round of rounds) {
        const artUrl =
          (round.imageKey && (await r2.getUrl(round.imageKey))) || null;
        allActiveRounds.push({
          ...round,
          leagueName: league.name,
          art: artUrl,
        });
      }
    }
    allActiveRounds.sort((a, b) => a.submissionDeadline - b.submissionDeadline);
    return allActiveRounds;
  },
});

export const manageRoundState = mutation({
  args: {
    roundId: v.id("rounds"),
    action: v.union(v.literal("startVoting"), v.literal("endVoting")),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round) throw new Error("Round not found");
    const { league, userId } = await checkOwnership(ctx, round.leagueId);

    switch (args.action) {
      case "startVoting":
        if (round.status !== "submissions")
          throw new Error("Round is not in submission phase.");
        await ctx.db.patch(args.roundId, { status: "voting" });
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.createForLeague,
          {
            leagueId: league._id,
            type: "round_voting",
            message: `Voting has begun for the round "${round.title}" in "${league.name}"!`,
            link: `/leagues/${league._id}/round/${round._id}`,
            triggeringUserId: userId,
          },
        );
        break;
      case "endVoting":
        if (round.status !== "voting")
          throw new Error("Round is not in voting phase.");
        const submissions = await ctx.db
          .query("submissions")
          .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
          .collect();
        const votes = await ctx.db
          .query("votes")
          .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
          .collect();
        if (submissions.length === 0) {
          throw new Error(
            "Cannot end round: at least one song must be submitted.",
          );
        }
        if (votes.length === 0) {
          throw new Error("Cannot end round: at least one vote must be cast.");
        }

        await ctx.db.patch(args.roundId, { status: "finished" });
        await ctx.scheduler.runAfter(
          0,
          internal.leagues.calculateAndStoreResults,
          {
            roundId: args.roundId,
          },
        );
        await ctx.scheduler.runAfter(0, internal.leagues.updateLeagueStats, {
          leagueId: round.leagueId,
        });
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.createForLeague,
          {
            leagueId: league._id,
            type: "round_finished",
            message: `The round "${round.title}" in "${league.name}" has finished! Check out the results.`,
            link: `/leagues/${league._id}/round/${round._id}`,
            triggeringUserId: userId,
          },
        );
        break;
    }
  },
});

export const adjustRoundTime = mutation({
  args: {
    roundId: v.id("rounds"),
    days: v.number(),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round) throw new Error("Round not found");
    await checkOwnership(ctx, round.leagueId);
    const timeAdjustment = args.days * 24 * 60 * 60 * 1000;
    if (round.status === "submissions") {
      await ctx.db.patch(round._id, {
        submissionDeadline: round.submissionDeadline + timeAdjustment,
        votingDeadline: round.votingDeadline + timeAdjustment,
      });
    } else if (round.status === "voting") {
      await ctx.db.patch(round._id, {
        votingDeadline: round.votingDeadline + timeAdjustment,
      });
    } else {
      throw new Error("Cannot adjust time for a finished round.");
    }
  },
});

export const updateRound = mutation({
  args: {
    roundId: v.id("rounds"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round) throw new Error("Round not found.");
    await checkOwnership(ctx, round.leagueId);
    if (round.status !== "submissions") {
      throw new Error("Only rounds open for submissions can be edited.");
    }
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
      .collect();
    if (submissions.length > 0) {
      throw new Error("Cannot edit a round with existing submissions.");
    }
    const { roundId, ...updates } = args;
    await ctx.db.patch(roundId, updates);
    return "Round updated successfully.";
  },
});

const songVoteDetailValidator = v.object({
  voterId: v.id("users"),
  voterName: v.string(),
  voterImage: v.union(v.string(), v.null()),
  vote: v.number(),
});

const voteSummaryValidator = v.array(
  v.object({
    submissionId: v.id("submissions"),
    songTitle: v.string(),
    artist: v.string(),
    submittedById: v.id("users"),
    submittedByName: v.string(),
    submittedByImage: v.union(v.string(), v.null()),
    albumArtUrl: v.union(v.string(), v.null()),
    votes: v.array(songVoteDetailValidator),
  }),
);

export const getVoteSummary = query({
  args: { roundId: v.id("rounds") },
  returns: voteSummaryValidator,
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round || round.status !== "finished") {
      return [];
    }

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
      .collect();

    if (votes.length === 0) return [];

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
      .collect();

    const allUserIds = new Set<Id<"users">>();
    votes.forEach((v) => allUserIds.add(v.userId));
    submissions.forEach((s) => allUserIds.add(s.userId));

    const users = await Promise.all(
      Array.from(allUserIds).map((userId) => ctx.db.get(userId)),
    );
    const userMap = new Map(
      users
        .filter((u): u is Doc<"users"> => u !== null)
        .map((user) => [user._id.toString(), user]),
    );

    const votesBySubmission = new Map<string, Doc<"votes">[]>();
    for (const vote of votes) {
      const subId = vote.submissionId.toString();
      if (!votesBySubmission.has(subId)) {
        votesBySubmission.set(subId, []);
      }
      votesBySubmission.get(subId)!.push(vote);
    }

    const summary = await Promise.all(
      submissions.map(async (submission) => {
        const submitter = userMap.get(submission.userId.toString());
        const submissionVotes =
          votesBySubmission.get(submission._id.toString()) || [];

        const voteDetails = submissionVotes.map((vote) => {
          const voter = userMap.get(vote.userId.toString());
          return {
            voterId: vote.userId,
            voterName: voter?.name ?? "Unknown",
            voterImage: voter?.image ?? null,
            vote: vote.vote,
          };
        });

        let albumArtUrl: string | null = null;
        if (submission.submissionType === "file" && submission.albumArtKey) {
          albumArtUrl = await r2.getUrl(submission.albumArtKey);
        } else {
          albumArtUrl = submission.albumArtUrlValue ?? null;
        }

        return {
          submissionId: submission._id,
          songTitle: submission.songTitle,
          artist: submission.artist,
          submittedById: submission.userId,
          submittedByName: submitter?.name ?? "Unknown",
          submittedByImage: submitter?.image ?? null,
          albumArtUrl: albumArtUrl,
          votes: voteDetails,
        };
      }),
    );

    return summary;
  },
});
