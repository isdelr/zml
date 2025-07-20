// convex/users.ts

import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (user === null) {
      return null;
    }
    return user;
  },
});

export const getProfile = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      name: v.string(),
      image: v.optional(v.string()),
      creationTime: v.number(),
      stats: v.object({
        leaguesJoined: v.number(),
        totalWins: v.number(),
        totalSubmissions: v.number(),
      }),
      leagues: v.array(
        v.object({
          _id: v.id("leagues"),
          name: v.string(),
          memberCount: v.number(),
          userRank: v.union(v.number(), v.null()),
          userScore: v.union(v.number(), v.null()),
          wins: v.number(),
          submissionCount: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    const allUserSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const leagueIds = memberships.map((m) => m.leagueId);
    let totalWins = 0;

    const leaguesData = await Promise.all(
      leagueIds.map(async (leagueId) => {
        const league = await ctx.db.get(leagueId);
        if (!league) return null;

        const allStandingsForLeague = await ctx.db
          .query("leagueStandings")
          .withIndex("by_league_and_points", (q) =>
            q.eq("leagueId", leagueId),
          )
          .order("desc")
          .collect();

       const userStanding = allStandingsForLeague.find(
          (s) => s.userId === args.userId,
        );

        const allSubmissionsInLeague = await ctx.db
          .query("submissions")
          .withIndex("by_user_and_league", (q) =>
            q.eq("userId", args.userId).eq("leagueId", leagueId),
          )
          .collect();

        const userRank = userStanding
          ? allStandingsForLeague.findIndex((s) => s.userId === args.userId) + 1
          : null;

        if (userStanding) {
          totalWins += userStanding.totalWins;
        }

        return {
          _id: league._id,
          name: league.name,
          memberCount: allStandingsForLeague.length,
          userRank,
          userScore: userStanding?.totalPoints ?? 0,
          wins: userStanding?.totalWins ?? 0,
          submissionCount: allSubmissionsInLeague.length,
        };
      }),
    );
    
    const filteredLeaguesData = leaguesData.filter(
      (l): l is NonNullable<typeof l> => l !== null,
    );

    return {
      _id: user._id,
      name: user.name ?? "Anonymous",
      image: user.image,
      creationTime: user._creationTime,
      stats: {
        leaguesJoined: filteredLeaguesData.length,
        totalWins,
        totalSubmissions: allUserSubmissions.length,
      },
      leagues: filteredLeaguesData,
    };
  },
});