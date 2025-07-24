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
    const roundsWithDetails = await Promise.all(
      rounds.map(async (round) => {
        const submissions = await ctx.db
          .query("submissions")
          .withIndex("by_round", (q) => q.eq("roundId", round._id))
          .collect();
        const artUrl =
          (round.imageKey && (await r2.getUrl(round.imageKey))) || null;
        return {
          ...round,
          submissionCount: submissions.length,
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
          .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
          .collect();
        const votes = await ctx.db
          .query("votes")
          .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
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
      .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
      .collect();
    if (submissions.length > 0) {
      throw new Error("Cannot edit a round with existing submissions.");
    }
    const { roundId, ...updates } = args;
    await ctx.db.patch(roundId, updates);
    return "Round updated successfully.";
  },
});

// Define the return type for better type checking on the client side
const voteDetailValidator = v.object({
  submissionId: v.id("submissions"),
  songTitle: v.string(),
  artist: v.string(),
  submittedById: v.optional(v.id("users")),
  submittedByName: v.string(),
});

const voteSummaryValidator = v.array(
  v.object({
    voterId: v.id("users"),
    voterName: v.string(),
    voterImage: v.optional(v.string()),
    upvotes: v.array(voteDetailValidator),
    downvotes: v.array(voteDetailValidator),
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
      .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
      .collect();

    if (votes.length === 0) return [];

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
      .collect();

    const submissionMap = new Map(
      submissions.map((sub) => [sub._id.toString(), sub]),
    );
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

    const voteSummaryByUser = new Map<
      string,
      {
        voter: Doc<"users">;
        upvotes: {
          submission: Doc<"submissions">;
          submitter: Doc<"users"> | undefined;
        }[];
        downvotes: {
          submission: Doc<"submissions">;
          submitter: Doc<"users"> | undefined;
        }[];
      }
    >();

    for (const vote of votes) {
      const voterIdString = vote.userId.toString();
      if (!voteSummaryByUser.has(voterIdString)) {
        const voter = userMap.get(voterIdString);
        if (voter) {
          voteSummaryByUser.set(voterIdString, {
            voter,
            upvotes: [],
            downvotes: [],
          });
        }
      }

      const summary = voteSummaryByUser.get(voterIdString);
      if (summary) {
        const submission = submissionMap.get(vote.submissionId.toString());
        if (submission) {
          const submitter = userMap.get(submission.userId.toString());
          const voteDetail = { submission, submitter };

          if (vote.vote > 0) summary.upvotes.push(voteDetail);
          else if (vote.vote < 0) summary.downvotes.push(voteDetail);
        }
      }
    }

    const result = Array.from(voteSummaryByUser.values()).map((summary) => ({
      voterId: summary.voter._id,
      voterName: summary.voter.name ?? "Unknown",
      voterImage: summary.voter.image ?? undefined,
      upvotes: summary.upvotes.map((uv) => ({
        submissionId: uv.submission._id,
        songTitle: uv.submission.songTitle,
        artist: uv.submission.artist,
        submittedById: uv.submitter?._id,
        submittedByName: uv.submitter?.name ?? "Unknown",
      })),
      downvotes: summary.downvotes.map((dv) => ({
        submissionId: dv.submission._id,
        songTitle: dv.submission.songTitle,
        artist: dv.submission.artist,
        submittedById: dv.submitter?._id,
        submittedByName: dv.submitter?.name ?? "Unknown",
      })),
    }));

    result.sort((a, b) => (a.voterName ?? "").localeCompare(b.voterName ?? ""));
    return result;
  },
});
