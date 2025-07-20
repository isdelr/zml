import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";

const r2 = new R2(components.r2);

// Helper to convert days to milliseconds
const daysToMs = (days: number) => days * 24 * 60 * 60 * 1000;
const FALLBACK_IMAGE_URL =
  "https://i.ytimg.com/vi/J7tp_0lFI0I/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDnX9OH1KITaxV876Nn-gONVGbK_w";

// Helper function to check if the current user is the league owner
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
  return league;
};

export const create = mutation({
  args: {
    leagueId: v.id("leagues"),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be logged in to create a round.");
    }

    const league = await ctx.db.get(args.leagueId);
    if (!league) {
      throw new Error("League not found.");
    }

    if (league.creatorId !== userId) {
      throw new Error(
        "You do not have permission to create a round in this league.",
      );
    }

    const now = Date.now();
    const submissionDeadline = now + daysToMs(league.submissionDeadline);
    const votingDeadline = submissionDeadline + daysToMs(league.votingDeadline);

    const roundId = await ctx.db.insert("rounds", {
      leagueId: args.leagueId,
      title: args.title,
      description: args.description,
      status: "submissions",
      submissionDeadline,
      votingDeadline,
    });

    return roundId;
  },
});

 export const getForLeague = query({
   args: { leagueId: v.id("leagues") },
   handler: async (ctx, args) => {
    const rounds = await ctx.db
       .query("rounds")
       .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
       .order("desc") // Show newest rounds first
       .collect();

    const roundsWithDetails = await Promise.all(
      rounds.map(async (round) => {
        const submissions = await ctx.db
          .query("submissions")
          .withIndex("by_round", (q) => q.eq("roundId", round._id))
          .collect();

        const artUrl =
          (round.imageKey && (await r2.getUrl(round.imageKey))) ||
          FALLBACK_IMAGE_URL;

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
  ): Promise<Array<Doc<"rounds"> & { leagueName: string; art: string }>> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const userLeagues = await ctx.db
      .query("leagues")
      .withIndex("by_creator", (q) => q.eq("creatorId", userId))
      .collect();

    if (userLeagues.length === 0) {
      return [];
    }

    const allActiveRounds: Array<
      Doc<"rounds"> & { leagueName: string; art: string }
    > = [];

    for (const league of userLeagues) {
      const rounds = await ctx.db
        .query("rounds")
        .withIndex("by_league", (q) => q.eq("leagueId", league._id))
        .filter((q) => q.neq(q.field("status"), "finished"))
        .collect();

      for (const round of rounds) {
        // Generate the URL for the image from its key
        const artUrl =
          (round.imageKey && (await r2.getUrl(round.imageKey))) ||
          FALLBACK_IMAGE_URL;

        allActiveRounds.push({
          ...round,
          leagueName: league.name,
          art: artUrl,
        });
      }
    }

    allActiveRounds.sort(
      (a, b) => a.submissionDeadline - b.submissionDeadline,
    );

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
    await checkOwnership(ctx, round.leagueId);

    switch (args.action) {
      case "startVoting":
        if (round.status !== "submissions")
          throw new Error("Round is not in submission phase.");
        await ctx.db.patch(args.roundId, { status: "voting" });
        break;
      case "endVoting":
        if (round.status !== "voting")
          throw new Error("Round is not in voting phase.");

        // Check conditions
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