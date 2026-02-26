import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { getAuthUserId } from "./authCore";
import { membershipsByUser, submissionsByUser } from "./aggregates";
import { internal } from "./_generated/api";
import { B2Storage } from "./b2Storage";
import {
  buildAvatarObjectKey,
  isAvatarObjectKey,
  resolveUserAvatarUrl,
} from "./userAvatar";

const storage = new B2Storage();

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const user = await ctx.db.get("users", userId);
    if (user === null) {
      return null;
    }

    const image = await resolveUserAvatarUrl(storage, user);
    return {
      ...user,
      image: image ?? undefined,
    };
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
    const user = await ctx.db.get("users", args.userId);
    if (!user) {
      return null;
    }
    const image = await resolveUserAvatarUrl(storage, user);

    const [leaguesJoined, totalSubmissions, memberships] = await Promise.all([
      membershipsByUser.count(ctx, {
        bounds: { eq: args.userId },
      }),

      submissionsByUser.count(ctx, {
        bounds: { eq: args.userId },
      }),

      ctx.db
        .query("memberships")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect(),
    ]);

    const leagueIds = memberships.map((m) => m.leagueId);
    let totalWins = 0;

    const leaguesData = await Promise.all(
      leagueIds.map(async (leagueId) => {
        const league = await ctx.db.get("leagues", leagueId);
        if (!league) return null;

        const allStandingsForLeague = await ctx.db
          .query("leagueStandings")
          .withIndex("by_league_and_points", (q) => q.eq("leagueId", leagueId))
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
      image: image ?? undefined,
      creationTime: user._creationTime,
      stats: {
        leaguesJoined,
        totalWins,
        totalSubmissions,
      },
      leagues: filteredLeaguesData,
    };
  },
});

export const syncCachedAvatar = action({
  args: {},
  returns: v.object({ updated: v.boolean() }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { updated: false };
    }

    const user = await ctx.runQuery(internal.users.getAvatarSyncTarget, {
      userId,
    });
    if (!user?.providerImageUrl) {
      return { updated: false };
    }

    if (
      isAvatarObjectKey(user.image) &&
      user.imageCachedFromUrl === user.providerImageUrl
    ) {
      return { updated: false };
    }

    const response = await fetch(user.providerImageUrl, {
      headers: {
        Accept: "image/webp,image/*;q=0.8,*/*;q=0.5",
      },
    });
    if (!response.ok) {
      return { updated: false };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return { updated: false };
    }

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > 5_000_000) {
      return { updated: false };
    }

    const avatarKey = buildAvatarObjectKey(userId.toString());
    await storage.putObject(avatarKey, new Uint8Array(bytes), {
      contentType: contentType || "image/webp",
      contentLength: bytes.byteLength,
    });

    await ctx.runMutation(internal.users.setCachedAvatar, {
      userId,
      avatarKey,
      sourceUrl: user.providerImageUrl,
    });

    return { updated: true };
  },
});

export const getAvatarSyncTarget = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      providerImageUrl: v.optional(v.string()),
      imageCachedFromUrl: v.optional(v.string()),
      image: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user) {
      return null;
    }

    return {
      providerImageUrl: user.providerImageUrl,
      imageCachedFromUrl: user.imageCachedFromUrl,
      image: user.image,
    };
  },
});

export const setCachedAvatar = internalMutation({
  args: {
    userId: v.id("users"),
    avatarKey: v.string(),
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user || user.providerImageUrl !== args.sourceUrl) {
      return;
    }

    await ctx.db.patch(args.userId, {
      image: args.avatarKey,
      imageCachedFromUrl: args.sourceUrl,
      imageCachedAt: Date.now(),
    });
  },
});
